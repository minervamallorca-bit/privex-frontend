import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

// NOW ACCEPTING 'theme' and 'toggleTheme' PROPS
export default function ChatRoom({ user, logout, theme, toggleTheme }) {
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
      text: content, type: type, sender: user.name, createdAt: serverTimestamp(), isSystem: false
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
    <div style={{...styles.container, background: theme.bg, color: theme.primary}}>
      <div style={{...styles.header, background: theme.bg, borderBottom: `1px solid ${theme.primary}`}}>
        <div style={styles.status}>
            <span style={{...styles.dot, background: theme.primary, boxShadow: `0 0 5px ${theme.primary}`}}></span>
            <span>SECURE_UPLINK</span>
        </div>
        <div style={styles.headerControls}>
          {/* THEME BUTTON */}
          <button onClick={toggleTheme} style={{...styles.iconBtn, color: theme.primary}}>🎨</button>
          
          <button onClick={() => startCall(false)} style={{...styles.iconBtn, color: theme.primary}}>📞</button>
          <button onClick={() => startCall(true)} style={{...styles.iconBtn, color: theme.primary}}>🎥</button>
          <button onClick={logout} style={{...styles.logoutBtn, borderColor: 'red', color: 'red'}}>EXIT</button>
        </div>
      </div>

      <div style={styles.chatWindow}>
        {messages.map((msg) => (
          <div key={msg.id} style={{...styles.messageRow, justifyContent: msg.sender === user.name ? 'flex-end' : 'flex-start'}}>
            <div style={msg.sender === user.name 
              ? {...styles.myBubble, background: theme.secondary, borderColor: theme.primary} 
              : {...styles.otherBubble, borderColor: '#444'}
            }>
              <div style={{...styles.senderName, color: theme.primary}}>{msg.sender.toUpperCase()}</div>
              {msg.type === 'text' && <DecryptedText text={msg.text} />}
              {msg.type === 'image' && <img src={msg.text} alt="attachment" style={styles.media} />}
              {msg.type === 'audio' && <audio src={msg.text} controls style={styles.audio} />}
              {(msg.type === 'video_call' || msg.type === 'voice_call') && (
                 <a href={msg.text} target="_blank" rel="noreferrer" style={{...styles.callLink, color: theme.primary, borderColor: theme.primary}}>
                   {msg.type === 'video_call' ? '🎥 JOIN VIDEO' : '📞 JOIN VOICE'}
                 </a>
              )}
            </div>
          </div>
        ))}
        {uploading && <div style={{textAlign:'center'}}>ENCRYPTING...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={{...styles.inputArea, background: theme.bg, borderTop: `1px solid ${theme.primary}`}}>
        <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()} style={{...styles.attachBtn, color: theme.primary}}>📎</button>
        <button onClick={toggleRecording} style={{...styles.attachBtn, color: isRecording ? 'red' : theme.primary}}>
            {isRecording ? '⏹' : '🎤'}
        </button>
        <input 
            style={{...styles.input, borderColor: theme.primary, color: theme.primary}} 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="TRANSMIT..." 
        />
        <button onClick={handleSend} style={{...styles.sendBtn, background: theme.primary}}>📤</button>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'monospace' },
  header: { padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  status: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' },
  headerControls: { display: 'flex', gap: '10px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%' },
  logoutBtn: { background: 'transparent', border: '1px solid', padding: '5px 10px', fontSize: '10px', cursor: 'pointer' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' },
  chatWindow: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
  messageRow: { display: 'flex', width: '100%' },
  myBubble: { border: '1px solid', color: '#fff', padding: '10px', borderRadius: '15px 15px 0 15px', maxWidth: '80%' },
  otherBubble: { background: '#222', border: '1px solid', color: '#ddd', padding: '10px', borderRadius: '15px 15px 15px 0', maxWidth: '80%' },
  senderName: { fontSize: '9px', marginBottom: '5px' },
  media: { maxWidth: '100%', borderRadius: '5px', marginTop: '5px' },
  audio: { width: '200px', marginTop: '5px' },
  callLink: { display: 'block', padding: '10px', textDecoration: 'none', border: '1px dashed', textAlign: 'center', marginTop: '5px' },
  inputArea: { padding: '15px', display: 'flex', gap: '10px', alignItems: 'center' },
  input: { flex: 1, padding: '15px', background: 'transparent', border: '1px solid', fontFamily: 'monospace', outline: 'none', borderRadius: '5px' },
  attachBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' },
  sendBtn: { color: '#000', border: 'none', padding: '0 20px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '5px' }
};