import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { 
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
  limit, setDoc, doc, getDoc, deleteDoc, updateDoc, where, increment 
} from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { 
  FaPowerOff, FaVideo, FaPhoneAlt, FaPaperPlane, FaArrowLeft, 
  FaHeart, FaHeartBroken, FaExclamationTriangle
} from 'react-icons/fa';

const APP_TITLE = "UMBRA SECURE (DEBUG MODE)";
const COPYRIGHT_TEXT = "GMYCO Technologies - ES / office@gmyco.es"; 

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

// --- LOGGING SYSTEM ---
let logs = [];
const addLog = (msg) => {
  const time = new Date().toLocaleTimeString();
  logs.unshift(`[${time}] ${msg}`);
  if(logs.length > 20) logs.pop();
  console.log(`[UMBRA] ${msg}`);
};

// --- AUDIO ---
let audioCtx = null;
const resumeAudio = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
};

const playSound = () => {
  resumeAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
};

// --- MAIN COMPONENT ---
function App() {
  const [view, setView] = useState('LOGIN'); 
  const [myProfile, setMyProfile] = useState(null); 
  const [activeFriend, setActiveFriend] = useState(null); 
  const [contacts, setContacts] = useState([]);
  const [friendStatuses, setFriendStatuses] = useState({});
  const [debugLog, setDebugLog] = useState([]);

  // INPUTS
  const [inputPhone, setInputPhone] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [friendPhone, setFriendPhone] = useState('');

  // CALL
  const [incomingCall, setIncomingCall] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [isVideo, setIsVideo] = useState(true);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);
  
  // CHAT
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const messagesEndRef = useRef(null);

  // DEBUG REFRESH
  useEffect(() => {
    const interval = setInterval(() => setDebugLog([...logs]), 1000);
    return () => clearInterval(interval);
  }, []);

  // 1. AUTO LOGIN & HEARTBEAT
  useEffect(() => {
    const creds = localStorage.getItem('umbra_creds');
    if (creds) {
      const { phone, password } = JSON.parse(creds);
      getDoc(doc(db, "users", phone)).then(snap => {
        if(snap.exists() && snap.data().password === password) {
          setMyProfile({ ...snap.data(), phone });
          addLog("AUTO-LOGIN SUCCESS");
          setView('APP');
        } else {
          addLog("AUTO-LOGIN FAILED: Invalid Creds");
        }
      }).catch(e => addLog(`LOGIN ERROR: ${e.message}`));
    }
  }, []);

  // HEARTBEAT (10s)
  useEffect(() => {
    if(!myProfile) return;
    const beat = setInterval(() => {
      updateDoc(doc(db, "users", myProfile.phone), { lastActive: serverTimestamp() })
        .catch(e => addLog(`HEARTBEAT FAIL: ${e.message}`));
    }, 10000);
    return () => clearInterval(beat);
  }, [myProfile]);

  // 2. INCOMING CALL LISTENER
  useEffect(() => {
    if(!myProfile) return;
    const q = query(collection(db, "calls"), where("to", "==", myProfile.phone));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (data.type === 'offer' && !callActive) {
            addLog(`INCOMING CALL FROM ${data.from}`);
            setIncomingCall({ id: change.doc.id, ...data });
            playSound();
          }
        }
      });
    });
    return () => unsub();
  }, [myProfile, callActive]);

  // 3. FRIEND STATUS LISTENER
  useEffect(() => {
    if(!myProfile) return;
    const unsub = onSnapshot(collection(db, "users", myProfile.phone, "friends"), (snap) => {
      const friends = snap.docs.map(d => d.data());
      setContacts(friends);
      addLog(`LOADED ${friends.length} FRIENDS`);
      
      friends.forEach(f => {
        onSnapshot(doc(db, "users", f.phone), (s) => {
          if(s.exists()) setFriendStatuses(prev => ({ ...prev, [f.phone]: s.data().lastActive }));
        });
      });
    });
    return () => unsub();
  }, [myProfile]);

  const getStatus = (phone) => {
    const last = friendStatuses[phone];
    if(!last) return false;
    const now = Date.now();
    const millis = last.toMillis ? last.toMillis() : last.seconds * 1000;
    return (now - millis) < 70000; 
  };

  // 4. CALL LOGIC
  const startCall = async (videoMode) => {
    if(!activeFriend) return;
    setIsVideo(videoMode);
    setCallActive(true);
    addLog(`STARTING ${videoMode ? 'VIDEO' : 'AUDIO'} CALL...`);

    const callId = `${myProfile.phone}_${activeFriend.phone}_${Date.now()}`;
    
    // SETUP PC
    pc.current = new RTCPeerConnection(ICE_SERVERS);
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoMode });
    if(localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(t => pc.current.addTrack(t, stream));

    pc.current.onicecandidate = (e) => {
      if(e.candidate) {
        addLog("GENERATED ICE CANDIDATE");
        // Update doc with candidate logic normally goes here, simplified for single doc push
      }
    };

    pc.current.ontrack = (e) => {
      if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);

    // SEND OFFER
    await setDoc(doc(db, "calls", callId), {
      from: myProfile.phone,
      to: activeFriend.phone,
      offer: JSON.stringify(offer),
      type: 'offer',
      isVideo: videoMode,
      createdAt: serverTimestamp()
    });
    addLog("OFFER SENT TO DB");

    // WAIT FOR ANSWER
    onSnapshot(doc(db, "calls", callId), async (snap) => {
      const data = snap.data();
      if(data?.type === 'answer' && !pc.current.currentRemoteDescription) {
        addLog("ANSWER RECEIVED");
        await pc.current.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.answer)));
      }
    });
  };

  const answerCall = async () => {
    if(!incomingCall) return;
    setCallActive(true);
    setIsVideo(incomingCall.isVideo);
    addLog("ANSWERING CALL...");

    pc.current = new RTCPeerConnection(ICE_SERVERS);
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.isVideo });
    if(localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(t => pc.current.addTrack(t, stream));

    pc.current.ontrack = (e) => {
      if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };

    await pc.current.setRemoteDescription(new RTCSessionDescription(JSON.parse(incomingCall.offer)));
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);

    await updateDoc(doc(db, "calls", incomingCall.id), {
      answer: JSON.stringify(answer),
      type: 'answer'
    });
    addLog("ANSWER SENT");
    setIncomingCall(null);
  };

  const login = async () => {
    if(inputPhone.length < 3) { addLog("INVALID PHONE"); return; }
    try {
      const userRef = doc(db, "users", inputPhone);
      await setDoc(userRef, { phone: inputPhone, name: inputName, password: inputPassword, lastActive: serverTimestamp() }, { merge: true });
      localStorage.setItem('umbra_creds', JSON.stringify({ phone: inputPhone, password: inputPassword }));
      setMyProfile({ phone: inputPhone, name: inputName });
      addLog("LOGIN SUCCESS");
      setView('APP');
    } catch(e) {
      addLog(`LOGIN FATAL ERROR: ${e.message}`);
      alert("DB ERROR: Check Log");
    }
  };

  // 5. CHAT LOGIC
  useEffect(() => {
    if(!activeFriend || !myProfile) return;
    const chatId = [myProfile.phone, activeFriend.phone].sort().join("_");
    const q = query(collection(db, "messages"), where("chatId", "==", chatId), orderBy("createdAt", "asc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => d.data());
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 100);
    }, (error) => {
      addLog(`MSG READ ERROR: ${error.message}`);
    });
    return () => unsub();
  }, [activeFriend, myProfile]);

  const sendText = async () => {
    if(!inputMsg) return;
    const chatId = [myProfile.phone, activeFriend.phone].sort().join("_");
    try {
      await addDoc(collection(db, "messages"), {
        text: inputMsg, sender: myProfile.phone, chatId, createdAt: serverTimestamp(), type: 'text'
      });
      setInputMsg('');
    } catch(e) { addLog(`SEND ERROR: ${e.message}`); }
  };

  // --- UI RENDER ---
  if(view === 'LOGIN') {
    return (
      <div style={styles.container}>
        <div style={styles.debugPanel}>
          <div style={{color:'orange'}}>SYSTEM LOGS:</div>
          {debugLog.map((l,i) => <div key={i}>{l}</div>)}
        </div>
        <div style={styles.center}>
          <h1 style={{color:'#00ff00'}}>UMBRA DIAGNOSTICS</h1>
          <input style={styles.input} placeholder="Phone" value={inputPhone} onChange={e=>setInputPhone(e.target.value)}/>
          <input style={styles.input} placeholder="Name" value={inputName} onChange={e=>setInputName(e.target.value)}/>
          <input style={styles.input} placeholder="Password" value={inputPassword} onChange={e=>setInputPassword(e.target.value)}/>
          <button style={styles.btn} onClick={login}>CONNECT TO SERVER</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* DEBUG OVERLAY */}
      <div style={styles.debugPanel}>
        <div style={{color:'orange'}}>LIVE DIAGNOSTICS:</div>
        {debugLog.map((l,i) => <div key={i}>{l}</div>)}
      </div>

      {incomingCall && !callActive && (
        <div style={styles.modal}>
          <h1>INCOMING CALL FROM {incomingCall.from}</h1>
          <button style={{...styles.btn, background:'green'}} onClick={answerCall}>ANSWER</button>
        </div>
      )}

      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={{padding:10, borderBottom:'1px solid #333'}}>
          {myProfile.name} <span style={{fontSize:10, color:'gray'}}>({myProfile.phone})</span>
        </div>
        <div style={{padding:10}}>
          <input style={styles.miniInput} placeholder="Add Friend Phone" value={friendPhone} onChange={e=>setFriendPhone(e.target.value)}/>
          <button style={styles.tinyBtn} onClick={async () => {
            if(!friendPhone) return;
            try {
              await setDoc(doc(db, "users", myProfile.phone, "friends", friendPhone), { phone: friendPhone, name: "User" });
              await setDoc(doc(db, "users", friendPhone, "friends", myProfile.phone), { phone: myProfile.phone, name: myProfile.name });
              addLog(`ADDED FRIEND: ${friendPhone}`);
              setFriendPhone('');
            } catch(e) { addLog(`ADD FAIL: ${e.message}`); }
          }}>ADD</button>
        </div>
        {contacts.map(c => (
          <div key={c.phone} style={styles.contact} onClick={()=>setActiveFriend(c)}>
            <div>{c.name}</div>
            <div style={{fontSize:10, color: getStatus(c.phone)?'#00ff00':'red'}}>
              {getStatus(c.phone) ? <FaHeart/> : <FaHeartBroken/>} {getStatus(c.phone)?'ONLINE':'OFFLINE'}
            </div>
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {activeFriend ? (
          <>
            <div style={styles.header}>
              {activeFriend.phone}
              <div style={{display:'flex', gap:10}}>
                <FaPhoneAlt onClick={()=>startCall(false)} style={{cursor:'pointer'}}/>
                <FaVideo onClick={()=>startCall(true)} style={{cursor:'pointer'}}/>
              </div>
            </div>

            {callActive && (
              <div style={styles.videoArea}>
                <video ref={remoteVideoRef} autoPlay playsInline style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                <video ref={localVideoRef} autoPlay playsInline muted style={{position:'absolute', bottom:10, right:10, width:100, border:'1px solid #fff'}}/>
                <button style={styles.hangupBtn} onClick={() => window.location.reload()}>END DEBUG SESSION</button>
              </div>
            )}

            <div style={styles.chat}>
              {messages.map((m,i) => (
                <div key={i} style={{alignSelf: m.sender===myProfile.phone?'flex-end':'flex-start', background:'#222', padding:5, margin:2}}>
                  {m.text}
                </div>
              ))}
              <div ref={messagesEndRef}/>
            </div>
            <div style={styles.inputArea}>
              <input style={styles.input} value={inputMsg} onChange={e=>setInputMsg(e.target.value)}/>
              <button style={styles.btn} onClick={sendText}><FaPaperPlane/></button>
            </div>
          </>
        ) : <div style={{padding:20}}>SELECT CONTACT</div>}
      </div>
    </div>
  );
}

const styles = {
  container: { display:'flex', height:'100vh', background:'black', color:'white', fontFamily:'monospace' },
  debugPanel: { position:'fixed', top:0, right:0, width:'200px', height:'200px', background:'rgba(0,0,0,0.8)', border:'1px solid red', fontSize:'10px', overflowY:'auto', zIndex:9999, pointerEvents:'none' },
  sidebar: { width:'250px', borderRight:'1px solid #333' },
  main: { flex:1, display:'flex', flexDirection:'column' },
  center: { margin:'auto', width:'300px', textAlign:'center' },
  input: { width:'100%', padding:10, background:'#111', border:'1px solid #333', color:'#00ff00', marginBottom:5 },
  miniInput: { width:'70%', padding:5, background:'#111', border:'1px solid #333', color:'white' },
  btn: { padding:10, background:'#00ff00', border:'none', cursor:'pointer', fontWeight:'bold' },
  tinyBtn: { width:'25%', padding:5, background:'blue', border:'none', color:'white' },
  contact: { padding:10, borderBottom:'1px solid #222', cursor:'pointer' },
  header: { padding:15, borderBottom:'1px solid #333', display:'flex', justifyContent:'space-between' },
  chat: { flex:1, overflowY:'auto', padding:10, display:'flex', flexDirection:'column' },
  inputArea: { padding:10, borderTop:'1px solid #333', display:'flex' },
  modal: { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', zIndex:1000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' },
  videoArea: { height:'300px', background:'#111', position:'relative', borderBottom:'1px solid #00ff00' },
  hangupBtn: { position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', background:'red', color:'white', padding:10, border:'none' }
};

export default App;