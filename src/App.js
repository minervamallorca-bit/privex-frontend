import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, setDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ---------------------------------------------------------
// 1. SOUNDS & UTILS
// ---------------------------------------------------------
const playSound = (type) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  if (type === 'purge') {
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
    oscillator.type = 'sawtooth';
    oscillator.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
  } else if (type === 'alert') {
    oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
    oscillator.type = 'sawtooth';
    oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
  } else {
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.type = 'sine';
    oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
  }

  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (type === 'purge' ? 0.5 : 0.1));
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + (type === 'purge' ? 0.5 : 0.3));
};

const getAvatar = (name) => `https://api.dicebear.com/7.x/bottts/svg?seed=${name}&backgroundColor=transparent`;

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
// 3. MAIN APPLICATION: UMBRA V17 (LIQUID DISPLAY)
// ---------------------------------------------------------
function App() {
  const [user, setUser] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]); 
  const [status, setStatus] = useState('UMBRA NET: SECURE');
  
  const [burnMode, setBurnMode] = useState(false); 
  const [videoMode, setVideoMode] = useState(false); 
  const [time, setTime] = useState(Date.now()); 

  const [loginName, setLoginName] = useState('');
  const [loginChannel, setLoginChannel] = useState('MAIN');
  const [loginKey, setLoginKey] = useState(''); 
  const [loginError, setLoginError] = useState('');

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastTypingTime = useRef(0);

  // --- CLEANUP TIMER ---
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now()); 
      messages.forEach(async (msg) => {
        if (msg.burnAt && msg.burnAt < Date.now() && msg.sender === user?.name) {
           try { await deleteDoc(doc(db, "messages", msg.id)); } catch(e) {}
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [messages, user]);

  // --- DATABASE LISTENER ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filteredMessages = allMessages.filter(msg => {
        const msgChannel = msg.channel || 'MAIN';
        if (msg.burnAt && msg.burnAt < Date.now()) return false; 
        return msgChannel === user.channel;
      });
      if (filteredMessages.length > messages.length && messages.length > 0) {
        const lastMsg = filteredMessages[filteredMessages.length - 1];
        if (lastMsg.sender !== user.name) playSound('ping');
      }
      setMessages(filteredMessages);
    });
    return () => unsubscribe();
  }, [user, messages.length]);

  // --- TYPING LISTENER ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "active_typing"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const now = Date.now();
        const activeTypers = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.channel === user.channel && (now - data.timestamp) < 4000) {
                activeTypers.push(data.user);
            }
        });
        setTypingUsers(activeTypers);
    });
    return () => unsubscribe();
  }, [user]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers, videoMode]);

  const handleInputChange = async (e) => {
    setInput(e.target.value);
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingTime.current > 1000) { 
        lastTypingTime.current = now;
        const docId = `${user.channel}_${user.name}`;
        try { await setDoc(doc(db, "active_typing", docId), { user: user.name, channel: user.channel, timestamp: now }); } catch (err) {}
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input, 'text');
    setInput('');
  };

  const sendMessage = async (content, type) => {
    if (!user) return;
    let msgData = { text: content, type: type, sender: user.name, channel: user.channel, createdAt: serverTimestamp() };
    if (burnMode) { msgData.burnAt = Date.now() + 60000; msgData.isBurn = true; }
    await addDoc(collection(db, "messages"), msgData);
  };

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

  const executePurge = () => {
    playSound('purge');
    setVideoMode(false);
    setUser(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginName.trim()) return;
    const safeChannel = loginChannel.trim().toUpperCase().replace(/\s/g, '_') || 'MAIN';
    const safeKey = loginKey.trim();
    const docRef = doc(db, "secure_channels", safeChannel);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.key && data.key !== safeKey) {
            setLoginError('ACCESS DENIED: INVALID KEY');
            playSound('alert');
            return;
        }
    } else {
        if (safeKey) await setDoc(docRef, { key: safeKey, creator: loginName });
    }
    setUser({ name: loginName, id: Date.now(), channel: safeChannel });
  };

  const joinCallInternal = (e) => {
    e.preventDefault();
    setVideoMode(true); 
  };

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.box}>
          <h1 style={{color: '#00ff00', letterSpacing: '8px', marginBottom:'10px', fontSize:'32px'}}>UMBRA</h1>
          <div style={{fontSize:'12px', color:'#00ff00', marginBottom:'30px', opacity:0.7}}>// UPLINK PROTOCOL V17.0</div>
          <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            <input value={loginName} onChange={e => setLoginName(e.target.value)} type="text" placeholder="CODENAME" style={styles.input} />
            <div style={{display:'flex', gap:'10px'}}>
                <input value={loginChannel} onChange={e => setLoginChannel(e.target.value)} type="text" placeholder="FREQUENCY" style={{...styles.input, flex:1}} />
                <input value={loginKey} onChange={e => setLoginKey(e.target.value)} type="password" placeholder="KEY (OPTIONAL)" style={{...styles.input, width:'120px'}} />
            </div>
            {loginError && <div style={{color:'red', fontWeight:'bold', fontSize:'12px'}}>{loginError}</div>}
            <button type="submit" style={styles.btn}>INITIATE UPLINK</button>
          </form>
        </div>
      </div>
    );
  }

  const secureHash = user.channel.replace(/[^a-zA-Z0-9]/g, '_'); 
  const callUrl = `https://meet.jit.si/UMBRA_SECURE_${secureHash}`;
  const configParams = [
    'config.startWithAudioMuted=true',
    'config.startWithVideoMuted=true',
    'config.disableDeepLinking=true',
    'interfaceConfig.MOBILE_APP_PROMO=false',
    'interfaceConfig.SHOW_JITSI_WATERMARK=false',
    'interfaceConfig.SHOW_BRAND_WATERMARK=false',
    'interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false',
    'interfaceConfig.HIDE_DEEP_LINKING_LOGO=true'
  ].join('&');
  const callSrc = `${callUrl}?lang=en#${configParams}`;

  return (
    <div style={styles.container}>
      {/* HEADER: Respects Safe Area */}
      <div style={styles.header}>
        <div>
          <span style={{fontWeight:'bold', display:'block', letterSpacing:'2px'}}>UMBRA // {user.channel}</span>
          <span style={{fontSize:'10px', color: status.includes('ERROR') ? 'red' : '#00ff00'}}>{status}</span>
        </div>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
           <button 
             onClick={() => setBurnMode(!burnMode)} 
             style={{...styles.iconBtn, width: 'auto', padding: '0 10px', fontSize:'12px', fontWeight:'bold', color: burnMode ? 'black' : 'orange', background: burnMode ? 'orange' : 'transparent', borderColor: 'orange'}}
           >
             {burnMode ? '🔥' : '🔥'}
           </button>
           <button onClick={() => setVideoMode(!videoMode)} style={{...styles.iconBtn, background: videoMode ? '#003300' : 'black'}}>
             {videoMode ? '🔼' : '🎥'}
           </button>
           <button onClick={executePurge} style={{...styles.iconBtn, color:'red', borderColor:'red', fontSize:'18px'}}>⚠️</button>
        </div>
      </div>

      {/* VIEWSCREEN */}
      {videoMode && (
        <div style={{height: '35%', borderBottom: '1px solid #00ff00', background: '#000'}}>
            <iframe src={callSrc} style={{width:'100%', height:'100%', border:'none'}} allow="camera; microphone; fullscreen; display-capture" title="Viewscreen" />
        </div>
      )}

      {/* CHAT AREA */}
      <div style={styles.chatArea}>
        {messages.map(msg => {
            let timeLeft = null;
            if (msg.burnAt) timeLeft = Math.max(0, Math.ceil((msg.burnAt - time) / 1000));
            return (
              <div key={msg.id} style={{display:'flex', flexDirection: 'column', alignItems: msg.sender === user.name ? 'flex-end' : 'flex-start', marginBottom:'15px'}}>
                 <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', flexDirection: msg.sender === user.name ? 'row-reverse' : 'row'}}>
                    <img src={getAvatar(msg.sender)} alt="avatar" style={{width:'25px', height:'25px', borderRadius:'50%', border:'1px solid #00ff00'}} />
                    <div style={{fontSize:'10px', color: '#00ff00', opacity:0.8}}>
                        {msg.sender.toUpperCase()}
                        {timeLeft !== null && <span style={{color:'orange', marginLeft:'5px'}}>🔥 {timeLeft}s</span>}
                    </div>
                 </div>
                 <div style={{...(msg.sender === user.name ? styles.myMsg : styles.otherMsg), borderColor: timeLeft !== null ? 'orange' : (msg.sender === user.name ? '#004400' : '#333')}}>
                    {msg.type === 'text' && <DecryptedText text={msg.text} />}
                    {msg.type === 'image' && <img src={msg.text} alt="content" style={{maxWidth:'100%', borderRadius:'5px'}} />}
                    {msg.type === 'audio' && <audio src={msg.text} controls style={{width:'200px', filter: 'invert(1)'}} />}
                    {(msg.type === 'video_call' || msg.type === 'voice_call') && (
                      <button onClick={joinCallInternal} style={styles.link}>
                        {msg.type === 'video_call' ? '🎥 OPEN SECURE FEED' : '📞 OPEN SECURE FEED'}
                      </button>
                    )}
                 </div>
              </div>
            );
        })}
        {typingUsers.length > 0 && <div style={{color: '#00ff00', fontSize: '10px', padding: '10px', animation: 'blink 1.5s infinite'}}>{typingUsers.map(u => u.toUpperCase()).join(', ')} IS TYPING...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA: Respects Bottom Safe Area */}
      <div style={styles.inputArea}>
        <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()} style={styles.iconBtn}>📎</button>
        <button onClick={toggleRecording} style={{...styles.iconBtn, color: isRecording ? 'red' : '#00ff00', borderColor: isRecording ? 'red' : '#00ff00'}}>{isRecording ? '⏹' : '🎤'}</button>
        <input value={input} onChange={handleInputChange} placeholder={burnMode ? "SELF-DESTRUCT..." : "ENCRYPTED MESSAGE..."} style={{...styles.inputBar, borderColor: burnMode ? 'orange' : '#333'}} onKeyPress={(e) => e.key === 'Enter' && handleSend()} />
        <button onClick={handleSend} style={{...styles.btn, background: burnMode ? 'orange' : '#00ff00'}}>SEND</button>
      </div>
    </div>
  );
}

// --- UPDATED STYLES FOR MOBILE ---
const styles = {
  // Use 'dvh' (dynamic viewport height) to ignore address bars
  container: { 
    height: '100dvh', 
    width: '100vw',
    background: '#080808', 
    color: '#00ff00', 
    fontFamily: 'Courier New, monospace', 
    display: 'flex', 
    flexDirection: 'column',
    overflow: 'hidden' // Prevent full page bounce
  },
  box: { margin: 'auto', border: '1px solid #00ff00', padding: '30px', width:'85%', maxWidth:'400px', textAlign: 'center', borderRadius: '2px', background: '#000', boxShadow: '0 0 20px rgba(0,255,0,0.1)' },
  input: { display: 'block', width: '100%', boxSizing:'border-box', background: '#0a0a0a', border: '1px solid #333', color: '#00ff00', padding: '15px', fontSize: '16px', outline: 'none', fontFamily:'monospace', marginBottom:'15px', borderRadius:'2px' },
  btn: { background: '#00ff00', color: 'black', border: 'none', padding: '15px', width: '100%', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', borderRadius: '2px', letterSpacing:'1px' },
  
  // Header Padding handles the Top Notch (env)
  header: { 
    paddingTop: 'calc(10px + env(safe-area-inset-top))', 
    paddingBottom: '10px',
    paddingLeft: '15px',
    paddingRight: '15px',
    background: '#0a0a0a', 
    borderBottom: '1px solid #1f1f1f', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    flexShrink: 0 
  },
  
  chatArea: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '15px', 
    scrollBehavior: 'smooth', 
    backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.95)), url("https://www.transparenttextures.com/patterns/carbon-fibre.png")',
    WebkitOverflowScrolling: 'touch' // Smooth scroll on iOS
  },
  
  myMsg: { background: 'rgba(0, 50, 0, 0.3)', border: '1px solid #004400', padding: '10px', borderRadius: '2px', maxWidth: '85%', color: '#e0ffe0', wordWrap: 'break-word' },
  otherMsg: { background: '#111', border: '1px solid #333', padding: '10px', borderRadius: '2px', maxWidth: '85%', color: '#ccc', wordWrap: 'break-word' },
  
  // Input Area Padding handles the Bottom Swipe Bar (env)
  inputArea: { 
    paddingTop: '10px',
    paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', 
    paddingLeft: '10px',
    paddingRight: '10px',
    background: '#0a0a0a', 
    borderTop: '1px solid #1f1f1f', 
    display: 'flex', 
    gap: '8px', 
    alignItems: 'center',
    flexShrink: 0
  },
  
  inputBar: { flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', fontFamily: 'monospace', outline: 'none', borderRadius: '2px', minWidth: 0 }, // minWidth 0 prevents flexbox blowout
  iconBtn: { background: 'black', border: '1px solid #333', borderRadius: '2px', width: '40px', height: '40px', fontSize: '18px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  link: { color: '#00ff00', border: '1px dashed #00ff00', padding: '10px', textDecoration: 'none', display: 'block', textAlign: 'center', marginTop: '5px', background: 'rgba(0,255,0,0.05)', cursor:'pointer', width: '100%', fontSize: '12px' }
};

export default App;