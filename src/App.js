import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, setDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ---------------------------------------------------------
// 1. SOUND & UTILS
// ---------------------------------------------------------
const playSound = () => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); 
  oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
  gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.1);
};

// Generates a unique robot avatar based on username
const getAvatar = (name) => {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${name}&backgroundColor=transparent`;
};

// ---------------------------------------------------------
// 2. DECRYPTION COMPONENT
// ---------------------------------------------------------
const DecryptedText = ({ text }) => {
  const [display, setDisplay] = useState('');
  const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(text.split('').map((letter, index) => {
        if (index < iteration) return text[index];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(''));
      if (iteration >= text.length) clearInterval(interval);
      iteration += 1 / 3; 
    }, 40); 
    return () => clearInterval(interval);
  }, [text]);
  return <span>{display}</span>;
};

// ---------------------------------------------------------
// 3. MAIN APPLICATION: UMBRA
// ---------------------------------------------------------
function App() {
  const [user, setUser] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]); 
  const [status, setStatus] = useState('UMBRA NET: SECURE'); 
  
  const [loginName, setLoginName] = useState('');
  const [loginChannel, setLoginChannel] = useState('MAIN');

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastTypingTime = useRef(0);

  // --- DATABASE LISTENER (MESSAGES) ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filteredMessages = allMessages.filter(msg => {
        const msgChannel = msg.channel || 'MAIN';
        return msgChannel === user.channel;
      });
      
      if (filteredMessages.length > messages.length && messages.length > 0) {
        const lastMsg = filteredMessages[filteredMessages.length - 1];
        if (lastMsg.sender !== user.name) playSound();
      }
      setMessages(filteredMessages);
    });
    return () => unsubscribe();
  }, [user, messages.length]);

  // --- DATABASE LISTENER (TYPING) ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "active_typing"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const now = Date.now();
        const activeTypers = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.channel === user.channel) {
                if (data.timestamp && (now - data.timestamp) < 4000) {
                    activeTypers.push(data.user);
                }
            }
        });
        setTypingUsers(activeTypers);
    }, (error) => setStatus("CONNECTION ERROR"));
    return () => unsubscribe();
  }, [user]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // --- INPUT HANDLERS ---
  const handleInputChange = async (e) => {
    setInput(e.target.value);
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingTime.current > 1000) { 
        lastTypingTime.current = now;
        const docId = `${user.channel}_${user.name}`;
        try {
            await setDoc(doc(db, "active_typing", docId), {
                user: user.name,
                channel: user.channel,
                timestamp: now
            });
        } catch (err) {}
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input, 'text');
    setInput('');
  };

  const sendMessage = async (content, type) => {
    if (!user) return;
    await addDoc(collection(db, "messages"), {
      text: content, 
      type: type, 
      sender: user.name,
      channel: user.channel, 
      createdAt: serverTimestamp() 
    });
  };

  // --- FILE UPLOAD ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileRef = ref(storage, `umbra_files/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      await sendMessage(url, type);
    } catch (err) { alert("Encryption Failed"); }
    setUploading(false);
  };

  // --- VOICE RECORDING ---
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        setUploading(true);
        const fileRef = ref(storage, `umbra_voice/${Date.now()}.mp3`);
        await uploadBytes(fileRef, audioBlob);
        const url = await getDownloadURL(fileRef);
        await sendMessage(url, 'audio');
        setUploading(false);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const startCall = (videoMode) => {
    const secureHash = user.channel.replace(/[^a-zA-Z0-9]/g, '_'); 
    const callUrl = `https://meet.jit.si/UMBRA_SECURE_${secureHash}_${Math.floor(Math.random() * 1000)}`;
    sendMessage(callUrl, videoMode ? 'video_call' : 'voice_call');
  };

  // --- LOGIN LOGIC ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginName.trim()) {
      const safeChannel = loginChannel.trim().toUpperCase().replace(/\s/g, '_') || 'MAIN';
      setUser({ name: loginName, id: Date.now(), channel: safeChannel });
    }
  };

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.box}>
          <h1 style={{color: '#00ff00', letterSpacing: '8px', marginBottom:'30px', fontSize:'32px'}}>UMBRA</h1>
          <div style={{fontSize:'12px', color:'#00ff00', marginBottom:'30px', opacity:0.7}}>// SHADOW PROTOCOL V1.0</div>
          <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            <input value={loginName} onChange={e => setLoginName(e.target.value)} type="text" placeholder="CODENAME" style={styles.input} />
            <input value={loginChannel} onChange={e => setLoginChannel(e.target.value)} type="text" placeholder="FREQUENCY (e.g. ALPHA)" style={styles.input} />
            <button type="submit" style={styles.btn}>INITIATE</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <span style={{fontWeight:'bold', display:'block', letterSpacing:'2px'}}>UMBRA // {user.channel}</span>
          <span style={{fontSize:'10px', color: status.includes('ERROR') ? 'red' : '#00ff00'}}>{status}</span>
        </div>
        <div style={{display:'flex', gap:'10px'}}>
           <button onClick={() => startCall(false)} style={styles.iconBtn}>📞</button>
           <button onClick={() => startCall(true)} style={styles.iconBtn}>🎥</button>
           <button onClick={() => setUser(null)} style={{...styles.iconBtn, color:'red', borderColor:'red'}}>X</button>
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={styles.chatArea}>
        {messages.map(msg => (
          <div key={msg.id} style={{display:'flex', flexDirection: 'column', alignItems: msg.sender === user.name ? 'flex-end' : 'flex-start', marginBottom:'15px'}}>
             
             {/* AVATAR & NAME */}
             <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', flexDirection: msg.sender === user.name ? 'row-reverse' : 'row'}}>
                <img src={getAvatar(msg.sender)} alt="avatar" style={{width:'25px', height:'25px', borderRadius:'50%', border:'1px solid #00ff00'}} />
                <div style={{fontSize:'10px', color: '#00ff00', opacity:0.8}}>{msg.sender.toUpperCase()}</div>
             </div>

             {/* MESSAGE BOX */}
             <div style={msg.sender === user.name ? styles.myMsg : styles.otherMsg}>
                {msg.type === 'text' && <DecryptedText text={msg.text} />}
                {msg.type === 'image' && <img src={msg.text} alt="content" style={{maxWidth:'100%', borderRadius:'5px'}} />}
                {msg.type === 'audio' && <audio src={msg.text} controls style={{width:'200px', filter: 'invert(1)'}} />}
                {(msg.type === 'video_call' || msg.type === 'voice_call') && (
                  <a href={msg.text} target="_blank" rel="noreferrer" style={styles.link}>
                    {msg.type === 'video_call' ? '🎥 SECURE LINK' : '📞 SECURE LINK'}
                  </a>
                )}
             </div>
          </div>
        ))}
        
        {/* TYPING INDICATOR */}
        {typingUsers.length > 0 && (
            <div style={{color: '#00ff00', fontSize: '10px', padding: '10px', animation: 'blink 1.5s infinite'}}>
                {typingUsers.map(u => u.toUpperCase()).join(', ')} IS TYPING...
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div style={styles.inputArea}>
        <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()} style={styles.iconBtn}>📎</button>
        <button onClick={toggleRecording} style={{...styles.iconBtn, color: isRecording ? 'red' : '#00ff00', borderColor: isRecording ? 'red' : '#00ff00'}}>
          {isRecording ? '⏹' : '🎤'}
        </button>
        <input 
          value={input} 
          onChange={handleInputChange}
          placeholder="ENCRYPTED MESSAGE..." 
          style={styles.inputBar}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} style={styles.btn}>SEND</button>
      </div>
    </div>
  );
}

// --- STYLES ---
const styles = {
  container: { height: '100vh', background: '#080808', color: '#00ff00', fontFamily: 'Courier New, monospace', display: 'flex', flexDirection: 'column' },
  box: { margin: 'auto', border: '1px solid #00ff00', padding: '50px', width:'90%', maxWidth:'400px', textAlign: 'center', borderRadius: '2px', background: '#000', boxShadow: '0 0 20px rgba(0,255,0,0.1)' },
  input: { display: 'block', width: '100%', boxSizing:'border-box', background: '#0a0a0a', border: '1px solid #333', color: '#00ff00', padding: '15px', fontSize: '16px', outline: 'none', fontFamily:'monospace', marginBottom:'15px', borderRadius:'2px' },
  btn: { background: '#00ff00', color: 'black', border: 'none', padding: '15px', width: '100%', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', borderRadius: '2px', letterSpacing:'1px' },
  header: { padding: '15px 20px', background: '#0a0a0a', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chatArea: { flex: 1, overflowY: 'auto', padding: '20px', scrollBehavior: 'smooth', backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.95)), url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' },
  myMsg: { background: 'rgba(0, 50, 0, 0.3)', border: '1px solid #004400', padding: '12px', borderRadius: '2px', maxWidth: '80%', color: '#e0ffe0' },
  otherMsg: { background: '#111', border: '1px solid #333', padding: '12px', borderRadius: '2px', maxWidth: '80%', color: '#ccc' },
  inputArea: { padding: '15px', background: '#0a0a0a', borderTop: '1px solid #1f1f1f', display: 'flex', gap: '10px', alignItems: 'center' },
  inputBar: { flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', fontFamily: 'monospace', outline: 'none', borderRadius: '2px' },
  iconBtn: { background: 'black', border: '1px solid #333', borderRadius: '2px', width: '45px', height: '45px', fontSize: '20px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  link: { color: '#00ff00', border: '1px dashed #00ff00', padding: '10px', textDecoration: 'none', display: 'block', textAlign: 'center', marginTop: '5px', background: 'rgba(0,255,0,0.05)' }
};

export default App;