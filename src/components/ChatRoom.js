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

export default function ChatRoom({ user, logout }) {
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
      text: content, 
      type: type,    
      sender: user.name,
      createdAt: serverTimestamp(),
      isSystem: false
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
    } catch (error) {
      console.error("Upload failed", error);
      alert("UPLOAD FAILED");
    }
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
        <div style={styles.status}><span style={styles.dot}></span><span>UPLINK_V3_FULL</span></div>
        <div style={styles.headerControls}>
          <button onClick={() => startCall(false)} style={styles.iconBtn}>📞</button>
          <button onClick={() => startCall(true)} style={styles.iconBtn}>🎥</button>
          <button onClick={logout} style={styles.logoutBtn}>EXIT</button>
        </div>
      </div>
      <div style={styles.chatWindow}>
        {messages.map((msg) => (
          <div key={msg.id} style={{...styles.messageRow, justifyContent: msg.sender === user.name ? 'flex-end' : 'flex-start'}}>
            <div style={msg.sender === user.name ? styles.myBubble : styles.otherBubble}>
              <div style={styles.senderName}>{msg.sender.toUpperCase()}</div>
              {msg.type === 'text' && <DecryptedText text={msg.text} />}
              {msg.type === 'image' && <img src={msg.text} alt="attachment" style={styles.media} />}
              {msg.type === 'video' && <video src={msg.text} controls style={styles.media} />}
              {msg.type === 'audio' && <audio src={msg.text} controls style={styles.audio} />}
              {(msg.type === 'video_call' || msg.type === 'voice_call') && (
                 <a href={msg.text} target="_blank" rel="noreferrer" style={styles.callLink}>
                   {msg.type === 'video_call' ? '🎥 JOIN SECURE VIDEO' : '📞 JOIN SECURE VOICE'}
                 </a>
              )}
              {msg.type === 'document' && <a href={msg.text} target="_blank" rel="noreferrer" style={{color:'#00ff00'}}>📄 DOWNLOAD FILE</a>}
            </div>
          </div>
        ))}
        {uploading && <div style={{color:'#00ff00', textAlign:'center'}}>UPLOADING ENCRYPTED DATA...</div>}
        <div ref={messagesEndRef} />
      </div>
      <div style={styles.inputArea}>
        <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()} style={styles.attachBtn}>📎</button>
        <button onClick={toggleRecording} style={{...styles.attachBtn, color: isRecording ? 'red' : '#00ff00'}}>
            {isRecording ? '⏹' : '🎤'}
        </button>
        <input style={styles.input} value={input} onChange={(e) => setInput(e.target.value)} placeholder={isRecording ? "RECORDING..." : "TRANSMIT DATA..."} />
        <button onClick={handleSend} style={styles.sendBtn}>📤</button>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#050505', color: '#00ff00', fontFamily: 'monospace' },
  header: { padding: '15px', borderBottom: '1px solid #333', background: '#0a0a0a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  status: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' },
  headerControls: { display: 'flex', gap: '10px' },
  dot: { width: '8px', height: '8px', background: '#00ff00', borderRadius: '50%', boxShadow: '0 0 5px #00ff00' },
  logoutBtn: { background: 'transparent', border: '1px solid #ff3333', color: '#ff3333', padding: '5px 10px', fontSize: '10px', cursor: 'pointer' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' },
  chatWindow: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
  messageRow: { display: 'flex', width: '100%' },
  myBubble: { background: 'rgba(0, 255, 0, 0.1)', border: '1px solid #00ff00', color: '#fff', padding: '10px', borderRadius: '15px 15px 0 15px', maxWidth: '80%' },
  otherBubble: { background: '#222', border: '1px solid #444', color: '#ddd', padding: '10px', borderRadius: '15px 15px 15px 0', maxWidth: '80%' },
  senderName: { fontSize: '9px', color: '#00ff00', marginBottom: '5px' },
  media: { maxWidth: '100%', borderRadius: '5px', marginTop: '5px' },
  audio: { width: '200px', marginTop: '5px' },
  callLink: { display: 'block', background: '#003300', padding: '10px', color: '#00ff00', textDecoration: 'none', border: '1px dashed #00ff00', textAlign: 'center', marginTop: '5px' },
  inputArea: { padding: '15px', background: '#0a0a0a', borderTop: '1px solid #333', display: 'flex', gap: '10px', alignItems: 'center' },
  input: { flex: 1, padding: '15px', background: '#000', border: '1px solid #333', color: '#fff', fontFamily: 'monospace', outline: 'none', borderRadius: '5px' },
  attachBtn: { background: 'none', border: 'none', color: '#00ff00', fontSize: '20px', cursor: 'pointer' },
  sendBtn: { background: '#00ff00', color: '#000', border: 'none', padding: '0 20px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '5px' }
};
