import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './App.css';

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
    }, 50); 
    return () => clearInterval(interval);
  }, [text]);
  return <span>{display}</span>;
};

// ---------------------------------------------------------
// 2. MAIN APPLICATION (Contains Login + Chat)
// ---------------------------------------------------------
function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false); // New uploading state
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- DATABASE LISTENER ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "messages"), orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    await addDoc(collection(db, "messages"), {
      text: content, 
      type: type, 
      sender: user.name, 
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
      alert("Upload Failed");
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
    const roomCode = Math.random().toString(36).substring(7);
    const callUrl = `https://meet.jit.si/PRIVEX_SECURE_${roomCode}`;
    sendMessage(callUrl, videoMode ? 'video_call' : 'voice_call');
  };

  // --- RENDER: LOGIN SCREEN ---
  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.box}>
          <h1 style={{color: '#00ff00', letterSpacing: '5px'}}>PRIVEX V5.0 (MONOLITH)</h1>
          <form onSubmit={(e) => {
            e.preventDefault();
            const name = e.target.elements.name.value;
            if (name.trim()) setUser({ name, id: Date.now() });
          }}>
            <input name="name" type="text" placeholder="IDENTITY REQUIRED" style={styles.input} />
            <button type="submit" style={styles.btn}>ACCESS</button>
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
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
          <div style={{width:'10px', height:'10px', background:'#00ff00', borderRadius:'50%'}}></div>
          <span>SECURE_CHANNEL</span>
        </div>
        <div>
          <button onClick={() => startCall(false)} style={styles.iconBtn}>📞</button>
          <button onClick={() => startCall(true)} style={styles.iconBtn}>🎥</button>
          <button onClick={() => setUser(null)} style={{...styles.iconBtn, color:'red'}}>❌</button>
        </div>
      </div>

      {/* MESSAGES */}
      <div style={styles.chatArea}>
        {messages.map(msg => (
          <div key={msg.id} style={{display:'flex', justifyContent: msg.sender === user.name ? 'flex-end' : 'flex-start', marginBottom:'10px'}}>
             <div style={msg.sender === user.name ? styles.myMsg : styles.otherMsg}>
                <div style={{fontSize:'10px', marginBottom:'5px', opacity: 0.7}}>{msg.sender}</div>
                
                {msg.type === 'text' && <DecryptedText text={msg.text} />}
                
                {msg.type === 'image' && <img src={msg.text} alt="content" style={{maxWidth:'100%', borderRadius:'5px'}} />}
                
                {msg.type === 'audio' && <audio src={msg.text} controls style={{maxWidth:'200px'}} />}
                
                {(msg.type === 'video_call' || msg.type === 'voice_call') && (
                  <a href={msg.text} target="_blank" rel="noreferrer" style={styles.link}>
                    {msg.type === 'video_call' ? 'JOIN VIDEO' : 'JOIN VOICE'}
                  </a>
                )}
             </div>
          </div>
        ))}
        {uploading && <div style={{textAlign:'center', color:'#00ff00'}}>ENCRYPTING...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div style={styles.inputArea}>
        <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()} style={styles.iconBtn}>📎</button>
        <button onClick={toggleRecording} style={{...styles.iconBtn, color: isRecording ? 'red' : '#00ff00'}}>
          {isRecording ? '⏹' : '🎤'}
        </button>
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="TRANSMIT..." 
          style={styles.inputBar}
        />
        <button onClick={handleSend} style={styles.btn}>SEND</button>
      </div>
    </div>
  );
}

// --- CSS STYLES (Internal) ---
const styles = {
  container: { height: '100vh', background: '#000', color: '#00ff00', fontFamily: 'monospace', display: 'flex', flexDirection: 'column' },
  box: { margin: 'auto', border: '1px solid #00ff00', padding: '40px', textAlign: 'center' },
  input: { display: 'block', margin: '20px auto', background: 'black', border: '1px solid #00ff00', color: '#00ff00', padding: '10px', textAlign: 'center' },
  btn: { background: '#00ff00', color: 'black', border: 'none', padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer' },
  header: { padding: '15px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' },
  chatArea: { flex: 1, overflowY: 'auto', padding: '20px' },
  myMsg: { background: '#002200', border: '1px solid #00ff00', padding: '10px', borderRadius: '10px', maxWidth: '80%' },
  otherMsg: { background: '#111', border: '1px solid #444', padding: '10px', borderRadius: '10px', maxWidth: '80%' },
  inputArea: { padding: '15px', borderTop: '1px solid #333', display: 'flex', gap: '10px', alignItems: 'center' },
  inputBar: { flex: 1, background: 'transparent', border: '1px solid #333', color: '#fff', padding: '10px' },
  iconBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#00ff00' },
  link: { color: '#00ff00', border: '1px dashed #00ff00', padding: '5px', textDecoration: 'none', display: 'block', textAlign: 'center' }
};

export default App;