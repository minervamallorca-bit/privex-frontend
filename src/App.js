import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ---------------------------------------------------------
// 1. DECRYPTION COMPONENT (The Matrix Effect)
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
// 2. MAIN APPLICATION
// ---------------------------------------------------------
function App() {
  const [user, setUser] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Login Inputs
  const [loginName, setLoginName] = useState('');
  const [loginChannel, setLoginChannel] = useState('MAIN');

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- DATABASE LISTENER (TROJAN HORSE METHOD) ---
  useEffect(() => {
    if (!user) return;
    
    // We query the MAIN collection (which we know works)
    // We grab the last 100 messages to keep it fast
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // CLIENT-SIDE FILTERING:
      // Only show messages that match our channel OR are global (legacy)
      const filteredMessages = allMessages.filter(msg => {
        // If message has no channel, show it in 'MAIN'
        const msgChannel = msg.channel || 'MAIN';
        return msgChannel === user.channel;
      });

      setMessages(filteredMessages);
    });

    return () => unsubscribe();
  }, [user]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- SEND FUNCTIONS ---
  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input, 'text');
    setInput('');
  };

  const sendMessage = async (content, type) => {
    if (!user) return;
    
    // We write to the MAIN collection, but we tag it with the channel
    await addDoc(collection(db, "messages"), {
      text: content, 
      type: type, 
      sender: user.name,
      channel: user.channel, // <--- THE TAG
      createdAt: serverTimestamp() 
    });
  };

  // --- FILE UPLOAD ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      
      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      
      await sendMessage(url, type);
    } catch (err) {
      console.error(err);
      alert("Encryption Failed (Upload Error)");
    }
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
        const fileRef = ref(storage, `voice/${Date.now()}.mp3`);
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
    const callUrl = `https://meet.jit.si/PRIVEX_${secureHash}_${Math.floor(Math.random() * 1000)}`;
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

  // --- RENDER: LOGIN SCREEN ---
  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.box}>
          <h1 style={{color: '#00ff00', letterSpacing: '5px', marginBottom:'30px'}}>PRIVEX V9.1 (PATCHED)</h1>
          <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            <div>
              <label style={styles.label}>IDENTITY</label>
              <input 
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
                type="text" 
                placeholder="OPERATOR NAME" 
                style={styles.input} 
              />
            </div>
            <div>
              <label style={styles.label}>FREQUENCY (ROOM)</label>
              <input 
                value={loginChannel}
                onChange={e => setLoginChannel(e.target.value)}
                type="text" 
                placeholder="DEFAULT: MAIN" 
                style={styles.input} 
              />
            </div>
            <button type="submit" style={styles.btn}>ESTABLISH UPLINK</button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER: CHAT SCREEN ---
  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{display:'flex', flexDirection:'column'}}>
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <div style={{width:'10px', height:'10px', background: user.channel === 'MAIN' ? 'red' : '#00ff00', borderRadius:'50%', boxShadow: '0 0 10px #00ff00'}}></div>
            <span style={{fontWeight:'bold'}}>FREQ: {user.channel}</span>
          </div>
          <span style={{fontSize:'10px', opacity:0.6, marginTop:'4px'}}>FILTER: ACTIVE</span>
        </div>
        
        <div style={{display:'flex', gap: '10px'}}>
          <button onClick={() => startCall(false)} style={styles.iconBtn} title="Voice Call">📞</button>
          <button onClick={() => startCall(true)} style={styles.iconBtn} title="Video Call">🎥</button>
          <button onClick={() => setUser(null)} style={{...styles.iconBtn, color:'red', borderColor:'red'}} title="Disconnect">X</button>
        </div>
      </div>

      {/* MESSAGES */}
      <div style={styles.chatArea}>
        {messages.length === 0 && (
           <div style={{textAlign:'center', opacity: 0.5, marginTop: '20px'}}>
              -- CHANNEL SILENT. START TRANSMISSION --
           </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{display:'flex', justifyContent: msg.sender === user.name ? 'flex-end' : 'flex-start', marginBottom:'10px'}}>
             <div style={msg.sender === user.name ? styles.myMsg : styles.otherMsg}>
                <div style={{fontSize:'10px', marginBottom:'5px', opacity: 0.7, color: '#00ff00'}}>
                  {msg.sender.toUpperCase()}
                </div>
                
                {msg.type === 'text' && <DecryptedText text={msg.text} />}
                
                {msg.type === 'image' && <img src={msg.text} alt="content" style={{maxWidth:'100%', borderRadius:'5px'}} />}
                
                {msg.type === 'audio' && <audio src={msg.text} controls style={{width:'200px', filter: 'invert(1)'}} />}
                
                {(msg.type === 'video_call' || msg.type === 'voice_call') && (
                  <a href={msg.text} target="_blank" rel="noreferrer" style={styles.link}>
                    {msg.type === 'video_call' ? '🎥 JOIN SECURE CALL' : '📞 JOIN SECURE CALL'}
                  </a>
                )}
             </div>
          </div>
        ))}
        {uploading && <div style={{textAlign:'center', color:'#00ff00', animation: 'blink 1s infinite'}}>UPLOADING DATA PACKET...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div style={styles.inputArea}>
        <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()} style={styles.iconBtn}>📎</button>
        
        <button onClick={toggleRecording} style={{...styles.iconBtn, color: isRecording ? 'red' : '#00ff00', borderColor: isRecording ? 'red' : '#00ff00'}}>
          {isRecording ? '⏹' : '🎤'}
        </button>
        
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder={`MESSAGE TO ${user.channel}...`} 
          style={styles.inputBar}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} style={styles.btn}>SEND</button>
      </div>
    </div>
  );
}

// --- STYLES (NO CHANGES) ---
const styles = {
  container: { height: '100vh', background: '#050505', color: '#00ff00', fontFamily: 'Courier New, monospace', display: 'flex', flexDirection: 'column' },
  box: { margin: 'auto', border: '1px solid #00ff00', padding: '40px', width:'90%', maxWidth:'400px', textAlign: 'center', borderRadius: '5px', boxShadow: '0 0 30px rgba(0,255,0,0.15)', background: '#000' },
  label: { display:'block', textAlign:'left', fontSize:'12px', marginBottom:'5px', opacity:0.8 },
  input: { display: 'block', width: '100%', boxSizing:'border-box', background: '#0a0a0a', border: '1px solid #333', color: '#00ff00', padding: '15px', fontSize: '16px', outline: 'none', fontFamily:'monospace', marginBottom:'10px' },
  btn: { background: '#00ff00', color: 'black', border: 'none', padding: '15px', width: '100%', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', borderRadius: '2px', marginTop:'10px' },
  header: { padding: '15px 20px', background: '#0a0a0a', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chatArea: { flex: 1, overflowY: 'auto', padding: '20px', scrollBehavior: 'smooth', backgroundImage: 'linear-gradient(rgba(0, 10, 0, 0.9), rgba(0, 10, 0, 0.9)), url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' },
  myMsg: { background: 'rgba(0, 40, 0, 0.6)', border: '1px solid #005500', padding: '12px', borderRadius: '8px 8px 0 8px', maxWidth: '80%', color: '#e0ffe0' },
  otherMsg: { background: '#111', border: '1px solid #333', padding: '12px', borderRadius: '8px 8px 8px 0', maxWidth: '80%', color: '#ccc' },
  inputArea: { padding: '15px', background: '#0a0a0a', borderTop: '1px solid #1f1f1f', display: 'flex', gap: '10px', alignItems: 'center' },
  inputBar: { flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', fontFamily: 'monospace', outline: 'none', borderRadius: '4px' },
  iconBtn: { background: 'black', border: '1px solid #333', borderRadius: '4px', width: '45px', height: '45px', fontSize: '20px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' },
  link: { color: '#00ff00', border: '1px dashed #00ff00', padding: '10px', textDecoration: 'none', display: 'block', textAlign: 'center', marginTop: '5px', background: 'rgba(0,255,0,0.05)' }
};

export default App;