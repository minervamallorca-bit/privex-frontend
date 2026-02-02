import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, setDoc, doc, getDoc, deleteDoc, updateDoc, where, getDocs, or, and } from 'firebase/firestore';
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
// 2. MAIN APPLICATION: UMBRA V21 (THE NETWORK)
// ---------------------------------------------------------
function App() {
  // APP STATE
  const [view, setView] = useState('LOGIN'); // LOGIN, CONTACTS, CHAT
  const [myProfile, setMyProfile] = useState(null); // { phone, name }
  const [activeFriend, setActiveFriend] = useState(null); // The friend we are chatting with
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  
  // LOGIN INPUTS
  const [inputPhone, setInputPhone] = useState('');
  const [inputName, setInputName] = useState('');
  
  // ADD FRIEND INPUT
  const [friendPhone, setFriendPhone] = useState('');
  const [addStatus, setAddStatus] = useState('');

  // CHAT STATE (From previous versions)
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('IDLE');
  
  // REFS
  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);
  const localStream = useRef(null);

  // -------------------------------------------------------
  // AUTH & LOGIN
  // -------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanPhone = inputPhone.replace(/\D/g, ''); // Remove non-digits
    if (cleanPhone.length < 5 || !inputName.trim()) return;

    const userDocRef = doc(db, "users", cleanPhone);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      // Register New User
      await setDoc(userDocRef, { phone: cleanPhone, name: inputName, createdAt: serverTimestamp() });
    } else {
      // Update Name if changed
      await updateDoc(userDocRef, { name: inputName });
    }
    
    setMyProfile({ phone: cleanPhone, name: inputName });
    setView('CONTACTS');
  };

  // -------------------------------------------------------
  // DATA LISTENERS (FRIENDS & REQUESTS)
  // -------------------------------------------------------
  useEffect(() => {
    if (!myProfile) return;

    // 1. Listen for INCOMING REQUESTS
    const qReq = query(collection(db, "friend_requests"), where("to", "==", myProfile.phone), where("status", "==", "pending"));
    const unsubReq = onSnapshot(qReq, (snap) => {
       const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setRequests(reqs);
       if(reqs.length > 0) playSound('ping');
    });

    // 2. Listen for MY CONTACTS (Mutual Friends)
    const qContacts = query(collection(db, "users", myProfile.phone, "friends"));
    const unsubContacts = onSnapshot(qContacts, (snap) => {
       setContacts(snap.docs.map(d => d.data()));
    });

    return () => { unsubReq(); unsubContacts(); };
  }, [myProfile]);

  // -------------------------------------------------------
  // FRIENDSHIP LOGIC
  // -------------------------------------------------------
  const sendFriendRequest = async () => {
    const targetPhone = friendPhone.replace(/\D/g, '');
    if (targetPhone === myProfile.phone) return setAddStatus("ERROR: CANNOT ADD SELF");
    
    // Check if user exists
    const targetDoc = await getDoc(doc(db, "users", targetPhone));
    if (!targetDoc.exists()) {
       // OPTIONAL: Send SMS invite logic here (requires paid API)
       // For now, we simulate the request waiting for them to join
       setAddStatus("USER NOT FOUND. TELL THEM TO JOIN UMBRA!");
       return;
    }

    // Send Request
    await addDoc(collection(db, "friend_requests"), {
       from: myProfile.phone,
       fromName: myProfile.name,
       to: targetPhone,
       status: 'pending',
       createdAt: serverTimestamp()
    });
    setAddStatus("REQUEST SENT");
    setFriendPhone('');
  };

  const acceptRequest = async (req) => {
    // 1. Add them to MY friends
    await setDoc(doc(db, "users", myProfile.phone, "friends", req.from), {
        phone: req.from,
        name: req.fromName
    });
    // 2. Add ME to THEIR friends
    await setDoc(doc(db, "users", req.from, "friends", myProfile.phone), {
        phone: myProfile.phone,
        name: myProfile.name
    });
    // 3. Delete Request
    await deleteDoc(doc(db, "friend_requests", req.id));
  };

  // -------------------------------------------------------
  // CHAT LOGIC (1-on-1)
  // -------------------------------------------------------
  // Generate a unique Channel ID for 1-on-1 (Always same order: low_high)
  const getChatID = (phoneA, phoneB) => {
     return parseInt(phoneA) < parseInt(phoneB) ? `${phoneA}_${phoneB}` : `${phoneB}_${phoneA}`;
  };

  const openChat = (friend) => {
     setActiveFriend(friend);
     setView('CHAT');
  };

  // Listen to messages for current active chat
  useEffect(() => {
    if (view !== 'CHAT' || !activeFriend || !myProfile) return;
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    
    const q = query(collection(db, "messages"), where("channel", "==", chatID), orderBy("createdAt", "asc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
       setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
       messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => unsub();
  }, [view, activeFriend, myProfile]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    await addDoc(collection(db, "messages"), {
       text: input,
       sender: myProfile.phone, // Use Phone as ID
       senderName: myProfile.name, // Display Name
       channel: chatID,
       type: 'text',
       createdAt: serverTimestamp()
    });
    setInput('');
  };

  // -------------------------------------------------------
  // VIDEO CALL LOGIC (GHOST WIRE V2)
  // -------------------------------------------------------
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
    
    // Signal DB
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
     await deleteDoc(doc(db, "calls", chatID));
     if(localStream.current) localStream.current.getTracks().forEach(t => t.stop());
     pc.current?.close();
     setCallActive(false);
  };

  // Signal Listener
  useEffect(() => {
      if (view !== 'CHAT' || !activeFriend) return;
      const chatID = getChatID(myProfile.phone, activeFriend.phone);
      const unsub = onSnapshot(doc(db, "calls", chatID), async (snap) => {
          const data = snap.data();
          if (data && data.type === 'offer' && data.sender !== myProfile.phone && !callActive) {
              setCallStatus('INCOMING CALL...');
              playSound('ring');
          }
          if (data && data.type === 'answer' && callActive && pc.current) {
              await pc.current.setRemoteDescription(JSON.parse(data.sdp));
          }
          if (!data && callActive) {
             // Call ended by other party
             setCallActive(false);
             if(localStream.current) localStream.current.getTracks().forEach(t => t.stop());
          }
      });
      return () => unsub();
  }, [view, activeFriend, callActive]);

  // -------------------------------------------------------
  // RENDER: LOGIN SCREEN
  // -------------------------------------------------------
  if (view === 'LOGIN') {
     return (
        <div style={styles.container}>
           <div style={styles.box}>
              <h1 style={{color: '#00ff00', fontSize: '32px', marginBottom:'20px'}}>UMBRA</h1>
              <div style={{color: '#00ff00', fontSize:'12px', marginBottom:'20px'}}>SECURE NETWORK V21</div>
              <input style={styles.input} placeholder="YOUR PHONE NUMBER" value={inputPhone} onChange={e => setInputPhone(e.target.value)} type="tel"/>
              <input style={styles.input} placeholder="CODENAME (DISPLAY NAME)" value={inputName} onChange={e => setInputName(e.target.value)}/>
              <button style={styles.btn} onClick={handleLogin}>ENTER NETWORK</button>
           </div>
        </div>
     );
  }

  // -------------------------------------------------------
  // RENDER: CONTACTS LIST (HOME)
  // -------------------------------------------------------
  if (view === 'CONTACTS') {
     return (
        <div style={styles.container}>
           {/* HEADER */}
           <div style={styles.header}>
              <div>
                  <span style={{fontWeight:'bold', display:'block'}}>{myProfile.name.toUpperCase()}</span>
                  <span style={{fontSize:'10px'}}>ID: {myProfile.phone}</span>
              </div>
              <button style={{...styles.iconBtn, color:'red'}} onClick={() => setView('LOGIN')}>⏻</button>
           </div>

           {/* ADD FRIEND SECTION */}
           <div style={{padding:'15px', borderBottom:'1px solid #333'}}>
              <div style={{display:'flex', gap:'10px'}}>
                  <input style={{...styles.inputBar, marginBottom:0}} placeholder="ADD PHONE NUMBER..." value={friendPhone} onChange={e => setFriendPhone(e.target.value)} type="tel"/>
                  <button style={styles.iconBtn} onClick={sendFriendRequest}>+</button>
              </div>
              {addStatus && <div style={{fontSize:'10px', color:'orange', marginTop:'5px'}}>{addStatus}</div>}
           </div>

           {/* REQUESTS LIST */}
           {requests.length > 0 && (
              <div style={{padding:'15px', background:'#111'}}>
                  <div style={{fontSize:'10px', color:'orange', marginBottom:'10px'}}>PENDING REQUESTS</div>
                  {requests.map(req => (
                      <div key={req.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                          <span>{req.fromName} ({req.from})</span>
                          <button style={{...styles.btn, padding:'5px 10px', width:'auto', fontSize:'10px'}} onClick={() => acceptRequest(req)}>ACCEPT</button>
                      </div>
                  ))}
              </div>
           )}

           {/* CONTACTS LIST */}
           <div style={{flex:1, overflowY:'auto', padding:'15px'}}>
              <div style={{fontSize:'10px', opacity:0.5, marginBottom:'10px'}}>CONTACTS</div>
              {contacts.map(contact => (
                  <div key={contact.phone} onClick={() => openChat(contact)} style={styles.contactRow}>
                      <img src={getAvatar(contact.name)} style={{width:'35px', height:'35px', borderRadius:'50%', border:'1px solid #00ff00'}}/>
                      <div style={{flex:1}}>
                         <div style={{fontWeight:'bold'}}>{contact.name}</div>
                         <div style={{fontSize:'10px', opacity:0.7}}>{contact.phone}</div>
                      </div>
                      <div style={{color:'#00ff00'}}>➤</div>
                  </div>
              ))}
              {contacts.length === 0 && <div style={{textAlign:'center', marginTop:'30px', opacity:0.5}}>NO CONTACTS. ADD A NUMBER ABOVE.</div>}
           </div>
        </div>
     );
  }

  // -------------------------------------------------------
  // RENDER: CHAT ROOM
  // -------------------------------------------------------
  return (
    <div style={styles.container}>
      {/* CHAT HEADER */}
      <div style={styles.header}>
         <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
             <button style={styles.iconBtn} onClick={() => setView('CONTACTS')}>←</button>
             <div>
                 <span style={{fontWeight:'bold', display:'block'}}>{activeFriend.name}</span>
                 <span style={{fontSize:'10px', color: callStatus.includes('INCOMING') ? 'orange' : '#00ff00'}}>
                     {callStatus === 'IDLE' ? activeFriend.phone : callStatus}
                 </span>
             </div>
         </div>
         <div style={{display:'flex', gap:'5px'}}>
             {!callActive && <button onClick={startCall} style={styles.iconBtn}>🎥</button>}
             {callStatus.includes('INCOMING') && <button onClick={answerCall} style={{...styles.iconBtn, background:'#00ff00', color:'black'}}>📞</button>}
             {callActive && <button onClick={endCall} style={{...styles.iconBtn, color:'red', borderColor:'red'}}>X</button>}
         </div>
      </div>

      {/* VIDEO AREA */}
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
         {messages.map(msg => (
             <div key={msg.id} style={{display:'flex', justifyContent: msg.sender === myProfile.phone ? 'flex-end' : 'flex-start', marginBottom:'10px'}}>
                 <div style={msg.sender === myProfile.phone ? styles.myMsg : styles.otherMsg}>
                     {msg.text}
                 </div>
             </div>
         ))}
         <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div style={styles.inputArea}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="MESSAGE..." style={styles.inputBar} onKeyPress={e => e.key === 'Enter' && sendMessage()}/>
          <button onClick={sendMessage} style={styles.sendBtn}>SEND</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------
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
  inputBar: { flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '0 12px', height: '44px', lineHeight: '44px', fontFamily: 'monospace', outline: 'none', borderRadius: '2px', minWidth: 0 },
  iconBtn: { background: 'black', border: '1px solid #333', borderRadius: '2px', width: '44px', height: '44px', minWidth: '44px', fontSize: '18px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtn: { background: '#00ff00', color: 'black', border: 'none', padding: '0 15px', height: '44px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', flexShrink: 0 },
  contactRow: { display:'flex', alignItems:'center', gap:'10px', padding:'15px', borderBottom:'1px solid #1f1f1f', cursor:'pointer', background:'rgba(0,255,0,0.02)' }
};

export default App;