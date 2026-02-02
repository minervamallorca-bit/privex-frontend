import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, setDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ---------------------------------------------------------
// 1. SOUND EFFECT (BEEP)
// ---------------------------------------------------------
const playSound = () => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz beep
  oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
  
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.1);
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
// 3. MAIN APPLICATION
// ---------------------------------------------------------
function App() {
  const [user, setUser] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]); 
  const [status, setStatus] = useState('ONLINE'); // Debug Status
  
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
      
      // Play sound if new message arrived and it's not from me
      if (filteredMessages.length > messages.length && messages.length > 0) {
        const lastMsg = filteredMessages[filteredMessages.length - 1];
        if (lastMsg.sender !== user.name) playSound();
      }
      
      setMessages(filteredMessages);
    });
    return () => unsubscribe();
  }, [user, messages.length]);

  // --- DATABASE LISTENER (TYPING STATUS) ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "active_typing"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const now = Date.now();
        const activeTypers = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // FILTER: Must be same channel & recent
            // REMOVED: "data.user !== user.name" so you can see YOURSELF (for testing)
            if (data.channel === user.channel) {
                if (data.timestamp && (now - data.timestamp) < 4000) {
                    activeTypers.push(data.user);
                }
            }
        });
        setTypingUsers(activeTypers);
    }, (error) => {
        console.error("Typing Listener Error:", error);
        setStatus("FIREWALL BLOCKING SIGNAL"); // Visual Error
    });

    return () => unsubscribe();
  }, [user]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // --- TYPING HANDLER ---
  const handleInputChange = async (e) => {
    setInput(e.target.value);
    if (!user) return;

    const now = Date.now();
    if (now - lastTypingTime.current > 1000) { // Update every 1s
        lastTypingTime.current = now;
        const docId = `${user.channel}_${user.name}`;
        
        try {
            await setDoc(doc(db, "active_typing", docId), {
                user: user.name,
                channel: user.channel,
                timestamp: now
            });
            setStatus("UPLINK SECURE");
        } catch (err) {
            console.error(err);
            setStatus("WRITE DENIED (CHECK RULES)");
        }
    }
  };

  // --- SEND FUNCTIONS ---
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
      const fileRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      await sendMessage(url, type);
    } catch (err) {
      alert("Encryption Failed (Upload Error)");
    }
    setUploading(false);
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
          <h1 style={{color: '#00ff00', letterSpacing: '5px', marginBottom:'30px'}}>PRIVEX V10.1 (SONAR)</h1>
          <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            <input value={loginName} onChange={e => setLoginName(e.target.value)} type="text" placeholder="IDENTITY" style={styles.input} />
            <input value={loginChannel} onChange={e => setLoginChannel(e.target.value)} type="text" placeholder="CHANNEL (e.g. TEST)" style={styles.input} />
            <button type="submit" style={styles.btn}>ESTABLISH UPLINK</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={{fontWeight:'bold', display:'block'}}>FREQ: {user.channel}</span>
          <span style={{fontSize:'10px', color: status.includes('DENIED') ? 'red' : '#00ff00'}}>{status}</span>
        </div>
        <button onClick={() => setUser(null)} style={{...styles.iconBtn, color:'red', borderColor:'red'}}>X</button>
      </div>

      <div style={styles.chatArea}>
        {messages.map(msg => (
          <div key={msg.id} style={{display:'flex', justifyContent: msg.sender === user.name ? 'flex-end' : 'flex-start', marginBottom:'10px'}}>
             <div style={msg.sender === user.name ? styles.myMsg : styles.otherMsg}>
                <div style={{fontSize:'10px', color: '#00ff00', marginBottom:'5px'}}>{msg.sender.toUpperCase()}</div>
                {msg.type === 'text' && <DecryptedText text={msg.text} />}
                {msg.type === 'image' && <img src={msg.text} alt="content" style={{maxWidth:'100%', borderRadius:'5px'}} />}
                {msg.type === 'audio' && <audio src={msg.text} controls style={{width:'200px', filter: 'invert(1)'}} />}
             </div>
          </div>
        ))}
        
        {/* V10.1: TYPING INDICATOR (Shows EVERYONE including you) */}
        {typingUsers.length > 0 && (
            <div style={{color: '#00ff00', fontSize: '12px', padding: '10px', animation: 'blink 1.5s infinite'}}>
                {typingUsers.map(u => u.toUpperCase()).join(', ')} IS ENCRYPTING...
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()} style={styles.iconBtn}>📎</button>
        <input 
          value={input} 
          onChange={handleInputChange}
          placeholder="TRANSMIT DATA..." 
          style={styles.inputBar}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} style={styles.btn}>SEND</button>
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100vh', background: '#050505', color: '#00ff00', fontFamily: 'Courier New, monospace', display: 'flex', flexDirection: 'column' },
  box: { margin: 'auto', border: '1px solid #00ff00', padding: '40px', width:'90%', maxWidth:'400px', textAlign: 'center', borderRadius: '5px', background: '#000' },
  input: { display: 'block', width: '100%', boxSizing:'border-box', background: '#0a0a0a', border: '1px solid #333', color: '#00ff00', padding: '15px', fontSize: '16px', outline: 'none', fontFamily:'monospace', marginBottom:'10px' },
  btn: { background: '#00ff00', color: 'black', border: 'none', padding: '15px', width: '100%', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', borderRadius: '2px' },
  header: { padding: '15px 20px', background: '#0a0a0a', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chatArea: { flex: 1, overflowY: 'auto', padding: '20px', scrollBehavior: 'smooth', backgroundImage: 'linear-gradient(rgba(0, 10, 0, 0.9), rgba(0, 10, 0, 0.9)), url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' },
  myMsg: { background: 'rgba(0, 40, 0, 0.6)', border: '1px solid #005500', padding: '12px', borderRadius: '8px 8px 0 8px', maxWidth: '80%', color: '#e0ffe0' },
  otherMsg: { background: '#111', border: '1px solid #333', padding: '12px', borderRadius: '8px 8px 8px 0', maxWidth: '80%', color: '#ccc' },
  inputArea: { padding: '15px', background: '#0a0a0a', borderTop: '1px solid #1f1f1f', display: 'flex', gap: '10px', alignItems: 'center' },
  inputBar: { flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', fontFamily: 'monospace', outline: 'none', borderRadius: '4px' },
  iconBtn: { background: 'black', border: '1px solid #333', borderRadius: '4px', width: '45px', height: '45px', fontSize: '20px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};

export default App;