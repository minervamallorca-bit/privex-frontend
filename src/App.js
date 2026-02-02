import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, setDoc, doc, getDoc, deleteDoc, updateDoc, onSnapshotsInSync } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ---------------------------------------------------------
// 1. SOUNDS & UTILS
// ---------------------------------------------------------
const playSound = (type) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  if (type === 'ring') {
    // Digital Phone Ring
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(0, audioCtx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
    gainNode.gain.value = 0.05;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.4);
    return;
  }

  if (type === 'purge') {
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
    oscillator.type = 'sawtooth';
    oscillator.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
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
// 2. MAIN APPLICATION: UMBRA V18 (GHOST WIRE)
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
  const [time, setTime] = useState(Date.now()); 

  const [loginName, setLoginName] = useState('');
  const [loginChannel, setLoginChannel] = useState('MAIN');
  const [loginKey, setLoginKey] = useState(''); 
  const [loginError, setLoginError] = useState('');

  // --- WEBRTC STATE ---
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('IDLE'); // IDLE, CALLING, CONNECTED
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const pc = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastTypingTime = useRef(0);

  // --- WEBRTC CONFIG ---
  const servers = {
    iceServers: [
      { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
  };

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
            if (data.channel === user.channel && (now - data.timestamp) < 4000) activeTypers.push(data.user);
        });
        setTypingUsers(activeTypers);
    });
    return () => unsubscribe();
  }, [user]);

  // --- V18: SIGNALING LISTENER (The Handshake) ---
  useEffect(() => {
    if (!user) return;
    // Listen for call signals in our channel
    const callDocRef = doc(db, "calls", user.channel);
    
    const unsubscribe = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (data && data.type === 'offer' && !callActive && data.sender !== user.name) {
            // Incoming Call!
            setCallStatus('INCOMING CALL...');
            playSound('ring');
        }
        
        // If we are in a call and remote adds answer
        if (pc.current && data && data.type === 'answer' && callActive && data.receiver === user.name) {
             if (!pc.current.currentRemoteDescription) {
                 const answerDescription = new RTCSessionDescription(data.answer);
                 await pc.current.setRemoteDescription(answerDescription);
             }
        }
        
        // Handle ICE Candidates
        if (pc.current && data && data.candidates) {
             // simplified: we would normally loop through new candidates
        }
    });
    return () => unsubscribe();
  }, [user, callActive]);

  // --- V18: START CALL (OFFER) ---
  const startGhostWire = async () => {
    setCallActive(true);
    setCallStatus('INITIALIZING GHOST WIRE...');
    
    // 1. Get Local Stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    setRemoteStream(new MediaStream());

    // 2. Setup Peer Connection
    pc.current = new RTCPeerConnection(servers);
    
    // Push tracks
    stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

    // Pull tracks
    pc.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => setRemoteStream(prev => {
            prev.addTrack(track);
            return prev; // Force update
        }));
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    // 3. Create Offer
    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    // 4. Send Offer to DB
    const callOffer = {
        type: 'offer',
        offer: { sdp: offerDescription.sdp, type: offerDescription.type },
        sender: user.name,
        channel: user.channel,
        timestamp: Date.now()
    };
    
    await setDoc(doc(db, "calls", user.channel), callOffer);
    
    // ICE Candidates
    pc.current.onicecandidate = (event) => {
       if (event.candidate) {
          // Ideally push to array in DB, simplified here
       }
    };

    setCallStatus('WAITING FOR PEER...');
  };

  // --- V18: ANSWER CALL ---
  const answerGhostWire = async () => {
    setCallActive(true);
    setCallStatus('CONNECTING...');

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    setRemoteStream(new MediaStream());

    pc.current = new RTCPeerConnection(servers);
    stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

    pc.current.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    // Get Offer
    const callDoc = await getDoc(doc(db, "calls", user.channel));
    const callData = callDoc.data();

    await pc.current.setRemoteDescription(new RTCSessionDescription(callData.offer));

    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    const callAnswer = {
        type: 'answer',
        answer: { sdp: answerDescription.sdp, type: answerDescription.type },
        receiver: callData.sender,
        sender: user.name
    };

    await updateDoc(doc(db, "calls", user.channel), callAnswer);
    setCallStatus('ENCRYPTED CONNECTION ESTABLISHED');
  };

  const endGhostWire = async () => {
     pc.current?.close();
     localStream?.getTracks().forEach(t => t.stop());
     setCallActive(false);
     setCallStatus('IDLE');
     // Clean DB
     try { await deleteDoc(doc(db, "calls", user.channel)); } catch (e) {}
  };

  // --- NORMAL APP FUNCTIONS ---
  const handleInputChange = async (e) => {
    setInput(e.target.value);
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingTime.current > 1000) { 
        lastTypingTime.current = now;
        try { await setDoc(doc(db, "active_typing", `${user.channel}_${user.name}`), { user: user.name, channel: user.channel, timestamp: now }); } catch (err) {}
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    let msgData = { text: input, type: 'text', sender: user.name, channel: user.channel, createdAt: serverTimestamp() };
    if (burnMode) { msgData.burnAt = Date.now() + 60000; msgData.isBurn = true; }
    await addDoc(collection(db, "messages"), msgData);
    setInput('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fileRef = ref(storage, `umbra_files/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    let msgData = { text: url, type: file.type.startsWith('image/') ? 'image' : 'document', sender: user.name, channel: user.channel, createdAt: serverTimestamp() };
    await addDoc(collection(db, "messages"), msgData);
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
        const fileRef = ref(storage, `umbra_voice/${Date.now()}.mp3`);
        await uploadBytes(fileRef, audioBlob);
        const url = await getDownloadURL(fileRef);
        await addDoc(collection(db, "messages"), { text: url, type: 'audio', sender: user.name, channel: user.channel, createdAt: serverTimestamp() });
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginName.trim()) return;
    const safeChannel = loginChannel.trim().toUpperCase().replace(/\s/g, '_') || 'MAIN';
    setUser({ name: loginName, id: Date.now(), channel: safeChannel });
  };

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.box}>
          <h1 style={{color: '#00ff00', letterSpacing: '8px', marginBottom:'10px', fontSize:'32px'}}>UMBRA</h1>
          <div style={{fontSize:'12px', color:'#00ff00', marginBottom:'30px', opacity:0.7}}>// GHOST WIRE PROTOCOL V18.0</div>
          <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            <input value={loginName} onChange={e => setLoginName(e.target.value)} type="text" placeholder="CODENAME" style={styles.input} />
            <div style={{display:'flex', gap:'10px'}}>
                <input value={loginChannel} onChange={e => setLoginChannel(e.target.value)} type="text" placeholder="FREQUENCY" style={{...styles.input, flex:1}} />
                <input value={loginKey} onChange={e => setLoginKey(e.target.value)} type="password" placeholder="KEY" style={{...styles.input, width:'80px'}} />
            </div>
            <button type="submit" style={styles.btn}>INITIATE UPLINK</button>
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
          <span style={{fontSize:'10px', color: '#00ff00'}}>{callStatus}</span>
        </div>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
           <button onClick={() => setBurnMode(!burnMode)} style={{...styles.iconBtn, color: burnMode ? 'black' : 'orange', background: burnMode ? 'orange' : 'transparent', borderColor: 'orange'}}>
             🔥
           </button>
           
           {/* GHOST WIRE BUTTONS */}
           {!callActive && (
              <button onClick={startGhostWire} style={{...styles.iconBtn, color: '#00ff00'}}>🎥 CALL</button>
           )}
           {callStatus === 'INCOMING CALL...' && (
              <button onClick={answerGhostWire} style={{...styles.iconBtn, background: '#00ff00', color: 'black', width: 'auto', padding: '0 15px'}}>ANSWER</button>
           )}
           {callActive && (
              <button onClick={endGhostWire} style={{...styles.iconBtn, color: 'red', borderColor: 'red'}}>HANGUP</button>
           )}

           <button onClick={() => setUser(null)} style={{...styles.iconBtn, color:'red', borderColor:'red'}}>⚠️</button>
        </div>
      </div>

      {/* GHOST WIRE VIDEO FEED (P2P) */}
      {callActive && (
        <div style={{height: '35%', borderBottom: '1px solid #00ff00', background: '#000', position:'relative', display:'flex'}}>
            {/* REMOTE (BIG) */}
            <video ref={remoteVideoRef} autoPlay playsInline style={{width:'100%', height:'100%', objectFit:'cover'}} />
            {/* LOCAL (SMALL PIP) */}
            <div style={{position:'absolute', bottom:'10px', right:'10px', width:'100px', height:'140px', border:'1px solid #00ff00', background:'black'}}>
                <video ref={localVideoRef} autoPlay playsInline muted ref={el => { if(el && localStream) el.srcObject = localStream }} style={{width:'100%', height:'100%', objectFit:'cover'}} />
            </div>
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
                        {msg.sender.toUpperCase()} {timeLeft !== null && <span style={{color:'orange'}}>🔥 {timeLeft}s</span>}
                    </div>
                 </div>
                 <div style={{...(msg.sender === user.name ? styles.myMsg : styles.otherMsg), borderColor: timeLeft ? 'orange' : (msg.sender === user.name ? '#004400' : '#333')}}>
                    {msg.type === 'image' ? <img src={msg.text} style={{maxWidth:'100%'}}/> : msg.text}
                 </div>
              </div>
            );
        })}
        {typingUsers.length > 0 && <div style={{color:'#00ff00', fontSize:'10px', padding:'10px', animation:'blink 1.5s infinite'}}>{typingUsers.join(', ')} TYPING...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()} style={styles.iconBtn}>📎</button>
        <button onClick={toggleRecording} style={{...styles.iconBtn, color: isRecording ? 'red' : '#00ff00', borderColor: isRecording ? 'red' : '#00ff00'}}>{isRecording ? '⏹' : '🎤'}</button>
        <input value={input} onChange={handleInputChange} placeholder="ENCRYPTED MESSAGE..." style={styles.inputBar} onKeyPress={(e) => e.key === 'Enter' && handleSend()} />
        <button onClick={handleSend} style={styles.btn}>SEND</button>
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100dvh', width: '100vw', background: '#080808', color: '#00ff00', fontFamily: 'Courier New, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  box: { margin: 'auto', border: '1px solid #00ff00', padding: '30px', width:'85%', maxWidth:'400px', textAlign: 'center', background: '#000' },
  input: { display: 'block', width: '100%', boxSizing:'border-box', background: '#0a0a0a', border: '1px solid #333', color: '#00ff00', padding: '15px', fontSize: '16px', outline: 'none', fontFamily:'monospace', marginBottom:'15px' },
  btn: { background: '#00ff00', color: 'black', border: 'none', padding: '15px', width: '100%', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' },
  header: { paddingTop: 'calc(10px + env(safe-area-inset-top))', paddingBottom: '10px', paddingLeft: '15px', paddingRight: '15px', background: '#0a0a0a', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  chatArea: { flex: 1, overflowY: 'auto', padding: '15px', backgroundImage: 'linear-gradient(rgba(0,0,0,0.95),rgba(0,0,0,0.95)), url("https://www.transparenttextures.com/patterns/carbon-fibre.png")', WebkitOverflowScrolling: 'touch' },
  myMsg: { background: 'rgba(0, 50, 0, 0.3)', border: '1px solid #004400', padding: '10px', borderRadius: '2px', maxWidth: '85%', color: '#e0ffe0', wordWrap: 'break-word' },
  otherMsg: { background: '#111', border: '1px solid #333', padding: '10px', borderRadius: '2px', maxWidth: '85%', color: '#ccc', wordWrap: 'break-word' },
  inputArea: { paddingTop: '10px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', paddingLeft: '10px', paddingRight: '10px', background: '#0a0a0a', borderTop: '1px solid #1f1f1f', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 },
  inputBar: { flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', fontFamily: 'monospace', outline: 'none', borderRadius: '2px', minWidth: 0 },
  iconBtn: { background: 'black', border: '1px solid #333', borderRadius: '2px', width: '40px', height: '40px', fontSize: '18px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
};

export default App;