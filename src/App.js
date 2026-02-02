import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, setDoc, doc, getDoc, deleteDoc, updateDoc, where, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ---------------------------------------------------------
// 1. UTILS & SOUNDS
// ---------------------------------------------------------
const playSound = (type) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  if (type === 'ring') {
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(0, audioCtx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
    gainNode.gain.value = 0.05;
  } else {
    oscillator.frequency.setValueAtTime(type === 'purge' ? 150 : 800, audioCtx.currentTime);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  }
  
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.3);
};

const getAvatar = (name) => `https://api.dicebear.com/7.x/bottts/svg?seed=${name}&backgroundColor=transparent`;

// ---------------------------------------------------------
// 2. MAIN APPLICATION: UMBRA V22 (COMMAND CENTER)
// ---------------------------------------------------------
function App() {
  // --- STATE ---
  const [view, setView] = useState('LOGIN'); // LOGIN, APP
  const [mobileView, setMobileView] = useState('LIST'); // LIST or CHAT (Mobile only)
  
  const [myProfile, setMyProfile] = useState(null); 
  const [activeFriend, setActiveFriend] = useState(null); 
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  
  const [inputPhone, setInputPhone] = useState('');
  const [inputName, setInputName] = useState('');
  
  const [friendPhone, setFriendPhone] = useState('');
  const [addStatus, setAddStatus] = useState('');

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('IDLE');
  
  const [burnMode, setBurnMode] = useState(false); 
  const [time, setTime] = useState(Date.now()); 
  
  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);
  const localStream = useRef(null);
  const fileInputRef = useRef(null);

  // --- RESPONSIVE CHECK ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- AUTH ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanPhone = inputPhone.replace(/\D/g, ''); 
    if (cleanPhone.length < 5 || !inputName.trim()) return;

    const userDocRef = doc(db, "users", cleanPhone);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      await setDoc(userDocRef, { phone: cleanPhone, name: inputName, createdAt: serverTimestamp() });
    } else {
      await updateDoc(userDocRef, { name: inputName });
    }
    
    setMyProfile({ phone: cleanPhone, name: inputName });
    setView('APP');
  };

  const handleLogout = () => {
    playSound('purge');
    setView('LOGIN');
    setMyProfile(null);
    setMessages([]);
    setActiveFriend(null);
  };

  // --- LISTENERS ---
  useEffect(() => {
    if (!myProfile) return;

    // Requests
    const qReq = query(collection(db, "friend_requests"), where("to", "==", myProfile.phone), where("status", "==", "pending"));
    const unsubReq = onSnapshot(qReq, (snap) => {
       const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setRequests(reqs);
       if(reqs.length > 0) playSound('ping');
    });

    // Contacts
    const qContacts = query(collection(db, "users", myProfile.phone, "friends"));
    const unsubContacts = onSnapshot(qContacts, (snap) => {
       setContacts(snap.docs.map(d => d.data()));
    });

    return () => { unsubReq(); unsubContacts(); };
  }, [myProfile]);

  // Burn Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now()); 
      messages.forEach(async (msg) => {
        if (msg.burnAt && msg.burnAt < Date.now() && msg.sender === myProfile?.phone) {
           try { await deleteDoc(doc(db, "messages", msg.id)); } catch(e) {}
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [messages, myProfile]);

  // --- FRIENDSHIP ---
  const sendFriendRequest = async () => {
    const targetPhone = friendPhone.replace(/\D/g, '');
    if (targetPhone === myProfile.phone) return setAddStatus("ERROR: SELF");
    
    const targetDoc = await getDoc(doc(db, "users", targetPhone));
    if (!targetDoc.exists()) {
       setAddStatus("USER NOT FOUND");
       return;
    }

    await addDoc(collection(db, "friend_requests"), {
       from: myProfile.phone,
       fromName: myProfile.name,
       to: targetPhone,
       status: 'pending',
       createdAt: serverTimestamp()
    });
    setAddStatus("REQ SENT");
    setFriendPhone('');
    setTimeout(() => setAddStatus(''), 3000);
  };

  const acceptRequest = async (req) => {
    await setDoc(doc(db, "users", myProfile.phone, "friends", req.from), { phone: req.from, name: req.fromName });
    await setDoc(doc(db, "users", req.from, "friends", myProfile.phone), { phone: myProfile.phone, name: myProfile.name });
    await deleteDoc(doc(db, "friend_requests", req.id));
  };

  // --- CHAT LOGIC ---
  const getChatID = (phoneA, phoneB) => parseInt(phoneA) < parseInt(phoneB) ? `${phoneA}_${phoneB}` : `${phoneB}_${phoneA}`;

  const selectFriend = (friend) => {
      setActiveFriend(friend);
      if (isMobile) setMobileView('CHAT');
  };

  const goBack = () => {
      setMobileView('LIST');
      // On mobile we don't clear activeFriend so the chat stays ready, but we change view
      if (!isMobile) setActiveFriend(null); 
  };

  useEffect(() => {
    if (!activeFriend || !myProfile) return;
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    
    const q = query(collection(db, "messages"), where("channel", "==", chatID), orderBy("createdAt", "asc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
       setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
       messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => unsub();
  }, [activeFriend, myProfile]);

  const sendMessage = async () => {
    if (!input.trim() || !activeFriend) return;
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    let msgData = { text: input, sender: myProfile.phone, senderName: myProfile.name, channel: chatID, type: 'text', createdAt: serverTimestamp() };
    if (burnMode) { msgData.burnAt = Date.now() + 60000; msgData.isBurn = true; }
    await addDoc(collection(db, "messages"), msgData);
    setInput('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeFriend) return;
    const fileRef = ref(storage, `umbra_files/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    let msgData = { text: url, type: file.type.startsWith('image/') ? 'image' : 'document', sender: myProfile.phone, senderName: myProfile.name, channel: chatID, createdAt: serverTimestamp() };
    if (burnMode) { msgData.burnAt = Date.now() + 60000; msgData.isBurn = true; }
    await addDoc(collection(db, "messages"), msgData);
  };

  const wipeChat = async () => {
    if (!window.confirm("CONFIRM: DELETE HISTORY?")) return;
    playSound('purge');
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    const q = query(collection(db, "messages"), where("channel", "==", chatID));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
    await batch.commit();
  };

  // --- VIDEO CALL ---
  const startCall = async () => {
    setCallActive(true);
    setCallStatus('DIALING...');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640 }, audio: true });
    localStream.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    pc.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun1.l.google.com:19302' }] });
    stream.getTracks().forEach(t => pc.current.addTrack(t, stream));
    pc.current.ontrack = e => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    await setDoc(doc(db, "calls", chatID), { type: 'offer', sdp: JSON.stringify(offer), sender: myProfile.phone });
  };

  const answerCall = async () => {
    setCallActive(true);
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    const callDoc = await getDoc(doc(db, "calls", chatID));
    const offer = JSON.parse(callDoc.data().sdp);
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640 }, audio: true });
    localStream.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    pc.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun1.l.google.com:19302' }] });
    stream.getTracks().forEach(t => pc.current.addTrack(t, stream));
    pc.current.ontrack = e => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    await pc.current.setRemoteDescription(offer);
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    await updateDoc(doc(db, "calls", chatID), { type: 'answer', sdp: JSON.stringify(answer) });
  };

  const endCall = async () => {
     const chatID = getChatID(myProfile.phone, activeFriend.phone);
     try { await deleteDoc(doc(db, "calls", chatID)); } catch(e) {}
     if(localStream.current) localStream.current.getTracks().forEach(t => t.stop());
     pc.current?.close();
     setCallActive(false);
  };

  useEffect(() => {
      if (!activeFriend) return;
      const chatID = getChatID(myProfile.phone, activeFriend.phone);
      const unsub = onSnapshot(doc(db, "calls", chatID), async (snap) => {
          const data = snap.data();
          if (data && data.type === 'offer' && data.sender !== myProfile.phone && !callActive) {
              setCallStatus('INCOMING...');
              playSound('ring');
          }
          if (data && data.type === 'answer' && callActive && pc.current) {
              await pc.current.setRemoteDescription(JSON.parse(data.sdp));
          }
          if (!data && callActive) {
             setCallActive(false);
             if(localStream.current) localStream.current.getTracks().forEach(t => t.stop());
          }
      });
      return () => unsub();
  }, [activeFriend, callActive]);

  // --- RENDER: LOGIN ---
  if (view === 'LOGIN') {
     return (
        <div style={styles.fullCenter}>
           <div style={styles.loginBox}>
              <h1 style={{color: '#00ff00', fontSize: '32px', marginBottom:'20px'}}>UMBRA</h1>
              <div style={{color: '#00ff00', fontSize:'12px', marginBottom:'20px'}}>SECURE NETWORK V22</div>
              <input style={styles.input} placeholder="PHONE NUMBER" value={inputPhone} onChange={e => setInputPhone(e.target.value)} type="tel"/>
              <input style={styles.input} placeholder="CODENAME" value={inputName} onChange={e => setInputName(e.target.value)}/>
              <button style={styles.btn} onClick={handleLogin}>ENTER</button>
           </div>
        </div>
     );
  }

  // --- RENDER: APP LAYOUT ---
  return (
    <div style={styles.container}>
      
      {/* SIDEBAR (CONTACTS) */}
      <div style={{
          ...styles.sidebar,
          display: isMobile && mobileView === 'CHAT' ? 'none' : 'flex' 
      }}>
          {/* SIDEBAR HEADER */}
          <div style={styles.sideHeader}>
             <div style={{flex:1}}>
                 <div style={{fontWeight:'bold'}}>{myProfile.name}</div>
                 <div style={{fontSize:'10px', opacity:0.7}}>{myProfile.phone}</div>
             </div>
             <button onClick={handleLogout} style={{...styles.iconBtnSmall, color:'red', borderColor:'#333'}}>⏻</button>
          </div>

          {/* ADD FRIEND INPUT (FIXED AT TOP) */}
          <div style={styles.addSection}>
              <div style={{display:'flex', gap:'5px'}}>
                  <input style={styles.miniInput} placeholder="ADD PHONE #" value={friendPhone} onChange={e => setFriendPhone(e.target.value)} type="tel"/>
                  <button onClick={sendFriendRequest} style={styles.iconBtnSmall}>+</button>
              </div>
              {addStatus && <div style={{fontSize:'10px', color:'orange', marginTop:'5px'}}>{addStatus}</div>}
          </div>

          {/* REQUESTS */}
          {requests.length > 0 && (
             <div style={{padding:'10px', background:'#221100'}}>
                 <div style={{fontSize:'9px', color:'orange', marginBottom:'5px'}}>PENDING</div>
                 {requests.map(req => (
                     <div key={req.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                         <span style={{fontSize:'12px'}}>{req.fromName}</span>
                         <button style={styles.tinyBtn} onClick={() => acceptRequest(req)}>ACCEPT</button>
                     </div>
                 ))}
             </div>
          )}

          {/* CONTACT LIST */}
          <div style={{flex:1, overflowY:'auto'}}>
              {contacts.map(c => (
                  <div key={c.phone} onClick={() => selectFriend(c)} style={{...styles.contactRow, background: activeFriend?.phone === c.phone ? '#111' : 'transparent'}}>
                      <img src={getAvatar(c.name)} style={styles.avatar}/>
                      <div style={{flex:1}}>
                          <div style={{fontWeight:'bold', fontSize:'14px'}}>{c.name}</div>
                          <div style={{fontSize:'10px', opacity:0.6}}>{c.phone}</div>
                      </div>
                      <div style={{color:'#00ff00'}}>➤</div>
                  </div>
              ))}
          </div>
      </div>

      {/* MAIN (CHAT) */}
      <div style={{
          ...styles.main,
          display: isMobile && mobileView === 'LIST' ? 'none' : 'flex'
      }}>
          {activeFriend ? (
              <>
                {/* CHAT HEADER */}
                <div style={styles.chatHeader}>
                    {isMobile && <button onClick={goBack} style={{...styles.iconBtn, marginRight:'10px'}}>←</button>}
                    <div style={{flex:1, overflow:'hidden'}}>
                        <div style={{fontWeight:'bold', whiteSpace:'nowrap'}}>{activeFriend.name}</div>
                        <div style={{fontSize:'10px', color: callStatus.includes('INCOMING') ? 'orange' : '#00ff00'}}>{callStatus === 'IDLE' ? 'SECURE LINK' : callStatus}</div>
                    </div>
                    
                    {/* TOOLBAR */}
                    <div style={{display:'flex', gap:'5px'}}>
                        <button onClick={wipeChat} style={{...styles.iconBtn, color:'#FF0000', borderColor:'#333'}}>🗑️</button>
                        <button onClick={() => setBurnMode(!burnMode)} style={{...styles.iconBtn, color: burnMode ? 'black' : 'orange', background: burnMode ? 'orange' : 'transparent', borderColor: 'orange'}}>🔥</button>
                        
                        {!callActive && <button onClick={startCall} style={styles.iconBtn}>🎥</button>}
                        {callStatus.includes('INCOMING') && <button onClick={answerCall} style={{...styles.iconBtn, background:'#00ff00', color:'black'}}>📞</button>}
                        {callActive && <button onClick={endCall} style={{...styles.iconBtn, color:'red', borderColor:'red'}}>X</button>}
                    </div>
                </div>

                {/* VIDEO FEED */}
                {callActive && (
                    <div style={{height: '35%', borderBottom: '1px solid #00ff00', background: '#000', position:'relative'}}>
                        <video ref={remoteVideoRef} autoPlay playsInline style={{width:'100%', height:'100%', objectFit:'cover'}} />
                        <div style={{position:'absolute', bottom:'10px', right:'10px', width:'80px', height:'110px', border:'1px solid #00ff00', background:'black'}}>
                            <video ref={localVideoRef} autoPlay playsInline muted style={{width:'100%', height:'100%', objectFit:'cover'}} />
                        </div>
                    </div>
                )}

                {/* MESSAGES */}
                <div style={styles.chatArea}>
                    {messages.map(msg => {
                        let timeLeft = null;
                        if (msg.burnAt) timeLeft = Math.max(0, Math.ceil((msg.burnAt - time) / 1000));
                        return (
                           <div key={msg.id} style={{display:'flex', justifyContent: msg.sender === myProfile.phone ? 'flex-end' : 'flex-start', marginBottom:'10px'}}>
                               <div style={{...(msg.sender === myProfile.phone ? styles.myMsg : styles.otherMsg), borderColor: timeLeft ? 'orange' : (msg.sender === myProfile.phone ? '#004400' : '#333')}}>
                                   {msg.type === 'image' ? <img src={msg.text} style={{maxWidth:'100%'}} alt="msg"/> : msg.text}
                                   {timeLeft !== null && <div style={{fontSize:'8px', color:'orange', marginTop:'5px'}}>🔥 {timeLeft}s</div>}
                               </div>
                           </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* INPUT */}
                <div style={styles.inputArea}>
                    <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current.click()} style={styles.iconBtn}>📎</button>
                    <input value={input} onChange={e => setInput(e.target.value)} placeholder="MESSAGE..." style={styles.inputBar} onKeyPress={e => e.key === 'Enter' && sendMessage()}/>
                    <button onClick={sendMessage} style={styles.sendBtn}>SEND</button>
                </div>
              </>
          ) : (
              // NO FRIEND SELECTED (DESKTOP)
              <div style={styles.emptyState}>
                 <h1 style={{fontSize:'40px', opacity:0.3}}>UMBRA</h1>
                 <div>SELECT A CONTACT TO BEGIN</div>
              </div>
          )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------
const styles = {
  container: { height: '100dvh', width: '100vw', background: '#080808', color: '#00ff00', fontFamily: 'Courier New, monospace', display: 'flex', overflow: 'hidden' },
  
  // LOGIN
  fullCenter: { height: '100dvh', width: '100vw', display:'flex', alignItems:'center', justifyContent:'center', background:'#080808' },
  loginBox: { border: '1px solid #00ff00', padding: '30px', width:'85%', maxWidth:'350px', textAlign: 'center', background: '#000' },
  input: { display: 'block', width: '100%', boxSizing:'border-box', background: '#0a0a0a', border: '1px solid #333', color: '#00ff00', padding: '15px', fontSize: '16px', outline: 'none', fontFamily:'monospace', marginBottom:'15px' },
  btn: { background: '#00ff00', color: 'black', border: 'none', padding: '15px', width: '100%', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' },

  // SIDEBAR
  sidebar: { width: '300px', borderRight: '1px solid #1f1f1f', display: 'flex', flexDirection: 'column', background:'#0a0a0a', flexShrink: 0, flexGrow: 1 },
  sideHeader: { padding: '15px', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background:'#000' },
  addSection: { padding: '10px', borderBottom: '1px solid #1f1f1f' },
  miniInput: { flex: 1, background: '#111', border: '1px solid #333', color: '#fff', padding: '8px', fontFamily: 'monospace', outline: 'none', fontSize: '12px' },
  tinyBtn: { background: '#00ff00', color:'black', border:'none', fontSize:'9px', padding:'3px 6px', cursor:'pointer' },
  contactRow: { display:'flex', alignItems:'center', gap:'10px', padding:'15px', borderBottom:'1px solid #1f1f1f', cursor:'pointer' },
  avatar: { width:'35px', height:'35px', borderRadius:'50%', border:'1px solid #00ff00' },

  // MAIN CHAT
  main: { flex: 1, display: 'flex', flexDirection: 'column', background:'#050505', minWidth: 0 },
  chatHeader: { padding: '10px 15px', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background:'#0a0a0a' },
  chatArea: { flex: 1, overflowY: 'auto', padding: '15px', backgroundImage: 'linear-gradient(rgba(0,0,0,0.95),rgba(0,0,0,0.95)), url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' },
  inputArea: { padding: '10px', borderTop: '1px solid #1f1f1f', display: 'flex', gap: '8px', alignItems: 'center', background:'#0a0a0a' },
  inputBar: { flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '0 12px', height: '44px', lineHeight: '44px', fontFamily: 'monospace', outline: 'none', borderRadius: '2px', minWidth: 0 },
  iconBtn: { background: 'black', border: '1px solid #333', borderRadius: '2px', width: '44px', height: '44px', minWidth: '44px', fontSize: '18px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBtnSmall: { background: 'black', border: '1px solid #333', borderRadius: '2px', width: '35px', height: '35px', fontSize: '16px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sendBtn: { background: '#00ff00', color: 'black', border: 'none', padding: '0 15px', height: '44px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', flexShrink: 0 },
  
  myMsg: { background: 'rgba(0, 50, 0, 0.3)', border: '1px solid #004400', padding: '10px', borderRadius: '2px', maxWidth: '85%', color: '#e0ffe0', wordWrap: 'break-word' },
  otherMsg: { background: '#111', border: '1px solid #333', padding: '10px', borderRadius: '2px', maxWidth: '85%', color: '#ccc', wordWrap: 'break-word' },
  emptyState: { flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#333' }
};

// MOBILE OVERRIDES HANDLED BY STATE AND FLEX LOGIC ABOVE

export default App;