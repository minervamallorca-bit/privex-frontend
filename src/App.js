import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; // NOTICE: We use ./firebase because we are in src/
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './App.css';

// --- COMPONENT: DECRYPTED TEXT ---
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

// --- COMPONENT: LOGIN ---
function Login({ onLogin }) {
  const [name, setName] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) onLogin({ name: name, id: Date.now() });
  };
  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginBox}>
        <h1 style={styles.loginTitle}>PRIVEX V4.0 (MONOLITH)</h1>
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="ENTER AGENT ID" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.loginInput}
          />
          <button type="submit" style={styles.loginButton}>INITIALIZE</button>
        </form>
      </div>
    </div>
  );
}

// --- COMPONENT: CHAT ROOM ---
function ChatRoom({ user, logout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input, 'text');
    setInput('');
  };

  const sendMessage = async (content, type) => {
    await addDoc(collection(db, "messages"), {
      text: content, type: type, sender: user.name, createdAt: serverTimestamp()
    });
  };

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
    } catch (error) { console.error("Upload failed", error); }
    setUploading(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { audioChunksRef.current.push(e.data); };
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.status}><span style={styles.dot}></span><span>SECURE_LINK</span></div>
        <div style={styles.controls}>
          <button onClick={() => startCall(false)} style={styles.iconBtn}>📞</button>
          <button onClick={() => startCall(true)} style={styles.iconBtn}>🎥</button>
          <button onClick={logout} style={styles.logoutBtn}>EXIT</button>
        </div>
      </div>
      <div style={styles.chatWindow}>
        {messages.map((msg) => (
          <div key={msg.id} style={{...styles.row, justifyContent: msg.sender === user.name ? 'flex-end' : 'flex-start'}}>
            <div style={msg.sender === user.name ? styles.myMsg : styles.otherMsg}>
              <div style={styles.sender}>{msg.sender.toUpperCase()}</div>
              {msg.type === 'text' && <DecryptedText text={msg.text} />}
              {msg.type === 'image' && <img src={msg.text} alt="img" style={styles.media} />}
              {msg.type === 'audio' && <audio src={msg.text} controls style={styles.media} />}
              {(msg.type === 'video_call' || msg.type === 'voice_call') && (
                 <a href={msg.text} target="_blank" rel="noreferrer" style={styles.callLink}>
                   {msg.type === 'video_call' ? '🎥 JOIN VIDEO' : '📞 JOIN VOICE'}
                 </a>
              )}
            </div>
          </div>
        ))}
        {uploading && <div style={{textAlign:'center'}}>ENCRYPTING...</div>}
        <div ref={messagesEndRef} />
      </div>
      <div style={styles.inputArea}>
        <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()} style={styles.iconBtn}>📎</button>
        <button onClick={toggleRecording} style={{...styles.iconBtn, color: isRecording ? 'red' : '#00ff00'}}>
            {isRecording ? '⏹' : '🎤'}
        </button>
        <input style={styles.input} value={input} onChange={(e) => setInput(e.target.value)} placeholder="TRANSMIT..." />
        <button onClick={handleSend} style={styles.sendBtn}>📤</button>
      </div>
    </div>
  );
}

// --- MAIN APP ---
function App() {
  const [user, setUser] = useState(null);
  return (
    <div className="App">
      {!user ? <Login onLogin={setUser} /> : <ChatRoom user={user} logout={() => setUser(null)} />}
    </div>
  );
}

// --- STYLES ---
const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#000', color: '#00ff00', fontFamily: 'monospace' },
  loginContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000', color: '#00ff00', fontFamily: 'monospace' },
  loginBox: { padding: '40px', border: '1px solid #00ff00', borderRadius: '10px', textAlign: 'center' },
  loginTitle: { fontSize: '24px', marginBottom: '20px' },
  loginInput: { width: '100%', padding: '15px', background: 'transparent', border: '1px solid #00ff00', color: '#00ff00', marginBottom: '20px', textAlign: 'center' },
  loginButton: { width: '100%', padding: '15px', background: '#00ff00', border: 'none', fontWeight: 'bold' },
  header: { padding: '15px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  status: { display: 'flex', alignItems: 'center', gap: '10px' },
  controls: { display: 'flex', gap: '10px' },
  dot: { width: '8px', height: '8px', background: '#00ff00', borderRadius: '50%' },
  chatWindow: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
  row: { display: 'flex', width: '100%' },
  myMsg: { background: '#002200', border: '1px solid #00ff00', padding: '10px', borderRadius: '15px', maxWidth: '80%' },
  otherMsg: { background: '#222', border: '1px solid #444', padding: '10px', borderRadius: '15px', maxWidth: '80%' },
  sender: { fontSize: '9px', marginBottom: '5px' },
  media: { maxWidth: '100%', marginTop: '5px' },
  callLink: { display: 'block', padding: '10px', color: '#00ff00', border: '1px dashed', textAlign: 'center' },
  inputArea: { padding: '15px', borderTop: '1px solid #333', display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '15px', background: '#000', border: '1px solid #333', color: '#fff' },
  iconBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#00ff00' },
  sendBtn: { background: '#00ff00', border: 'none', padding: '0 20px', fontWeight: 'bold' },
  logoutBtn: { background: 'transparent', border: '1px solid red', color: 'red', fontSize: '10px' }
};

export default App;