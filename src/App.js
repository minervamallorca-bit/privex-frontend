import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { 
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
  limit, setDoc, doc, getDoc, deleteDoc, updateDoc, where, writeBatch 
} from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ICONS
import { 
  FaPowerOff, FaVideo, FaPhoneAlt, FaPaperPlane, FaArrowLeft, 
  FaHeart, FaHeartBroken, FaPaperclip, FaChevronRight, FaPhoneSlash,
  FaCog, FaUserMinus, FaBroom, FaFire, FaMicrophone, FaSmile
} from 'react-icons/fa';

// ---------------------------------------------------------
// 1. ASSETS & CONFIG
// ---------------------------------------------------------
const APP_LOGO = "https://img.icons8.com/fluency/96/fingerprint-scan.png"; 
const APP_TITLE = "UMBRA SECURE"; 
const LOGIN_TITLE = "UMBRA V58"; // CHECK FOR THIS!
const COPYRIGHT_TEXT = "GMYCO Technologies - ES / office@gmyco.es"; 

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

// AUDIO
let audioCtx = null;
const resumeAudio = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
};

const playSound = (type) => {
  resumeAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === 'message') {
    osc.type = 'square'; 
    osc.frequency.setValueAtTime(880, now); 
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'ring') { 
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.1);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.6);
  } else if (type === 'purge') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
};

const getAvatar = (user) => {
    if (!user) return `https://api.dicebear.com/7.x/bottts/svg?seed=Unknown&backgroundColor=transparent`;
    if (user.avatar) return user.avatar;
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name || 'User'}&backgroundColor=transparent`;
};

const GlitchStyles = () => (
  <style>
    {`
      @keyframes matrix-decode {
        0% { opacity: 0; text-shadow: 0 0 5px #0f0; }
        20% { opacity: 1; color: #ccffcc; }
        40% { opacity: 0.8; color: #00ff41; }
        60% { opacity: 1; text-shadow: 2px 0 red, -2px 0 blue; }
        80% { opacity: 0.9; text-shadow: none; }
        100% { opacity: 1; color: #00ff41; }
      }
      .matrix-text {
        font-family: 'Courier New', monospace;
        color: #00ff41;
        font-weight: bold;
        animation: matrix-decode 0.4s ease-out forwards;
        text-shadow: 0 0 3px rgba(0, 255, 65, 0.5);
        letter-spacing: 0.5px;
      }
    `}
  </style>
);

// ---------------------------------------------------------
// 2. MAIN APP
// ---------------------------------------------------------
function App() {
  const [view, setView] = useState('LOGIN'); 
  const [mobileView, setMobileView] = useState('LIST'); 
  const [myProfile, setMyProfile] = useState(null); 
  const [activeFriend, setActiveFriend] = useState(null); 
  const [contacts, setContacts] = useState([]);
  const [friendStatuses, setFriendStatuses] = useState({});

  // INPUTS
  const [inputPhone, setInputPhone] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [loginError, setLoginError] = useState('');

  // SETTINGS
  const [editName, setEditName] = useState('');
  const [editWallpaper, setEditWallpaper] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // CALLS
  const [incomingCall, setIncomingCall] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [activeCallId, setActiveCallId] = useState(null);
  const [isVideo, setIsVideo] = useState(true);
  
  // CHAT
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [burnMode, setBurnMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // REFS
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);
  const localStream = useRef(null);
  const messagesEndRef = useRef(null);
  const ringInterval = useRef(null);
  const fileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    window.addEventListener('resize', () => setIsMobile(window.innerWidth < 768));
  }, []);

  // WAKE LOCK & INIT
  useEffect(() => {
      const wakeUp = () => resumeAudio();
      window.addEventListener('click', wakeUp);
      window.addEventListener('touchstart', wakeUp);
      document.title = APP_TITLE;
      return () => {
          window.removeEventListener('click', wakeUp);
          window.removeEventListener('touchstart', wakeUp);
      };
  }, []);

  // HEARTBEAT
  useEffect(() => {
      if (!myProfile) return;
      const beat = setInterval(() => {
          updateDoc(doc(db, "users", myProfile.phone), { lastActive: serverTimestamp() });
      }, 10000); 
      return () => clearInterval(beat);
  }, [myProfile]);

  // AUTO LOGIN
  useEffect(() => {
    const storedCreds = localStorage.getItem('umbra_creds');
    if (storedCreds) {
      const { phone, password } = JSON.parse(storedCreds);
      getDoc(doc(db, "users", phone)).then(snap => {
        if (snap.exists() && snap.data().password === password) {
           setMyProfile({ ...snap.data(), phone });
           setView('APP');
        }
      });
    }
  }, []);

  // STATUS MONITOR
  useEffect(() => {
      if (!contacts || contacts.length === 0) return;
      const unsubs = contacts.map(c => 
          onSnapshot(doc(db, "users", c.phone), (d) => {
              if(d.exists() && d.data().lastActive) {
                  setFriendStatuses(prev => ({ ...prev, [c.phone]: d.data().lastActive }));
              }
          })
      );
      return () => unsubs.forEach(u => u());
  }, [contacts]);

  const getStatus = (phone) => {
      const last = friendStatuses[phone];
      if (!last) return false;
      const now = Date.now();
      const millis = last.toMillis ? last.toMillis() : last.seconds * 1000;
      return (now - millis) < 70000; 
  };

  // GLOBAL CALL LISTENER
  useEffect(() => {
    if(!myProfile) return;
    const q = query(collection(db, "calls"), where("to", "==", myProfile.phone), where("type", "==", "offer"));
    const unsub = onSnapshot(q, (snap) => {
      if(!snap.empty) {
        const docData = snap.docs[0];
        if(!callActive && !incomingCall) {
          setIncomingCall({ id: docData.id, ...docData.data() });
          if(!ringInterval.current) {
            playSound('ring');
            ringInterval.current = setInterval(() => playSound('ring'), 2500);
          }
        }
      } else {
        if(incomingCall && !callActive) {
          setIncomingCall(null);
          if(ringInterval.current) { clearInterval(ringInterval.current); ringInterval.current = null; }
        }
      }
    });
    return () => unsub();
  }, [myProfile, callActive, incomingCall]);

  // FRIEND LIST LISTENER
  useEffect(() => {
    if(!myProfile) return;
    const unsub = onSnapshot(collection(db, "users", myProfile.phone, "friends"), (snap) => {
      setContacts(snap.docs.map(d => d.data()));
    });
    return () => unsub();
  }, [myProfile]);

  const handleLogin = async () => {
    const cleanPhone = inputPhone.replace(/\D/g, ''); 
    if (cleanPhone.length < 5) { setLoginError('INVALID INPUT'); return; }
    const userRef = doc(db, "users", cleanPhone);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, { phone: cleanPhone, name: inputName, password: inputPassword, lastActive: serverTimestamp() });
    } else {
      if (snap.data().password !== inputPassword) { setLoginError('WRONG PASSWORD'); return; }
      await updateDoc(userRef, { lastActive: serverTimestamp() });
    }
    localStorage.setItem('umbra_creds', JSON.stringify({ phone: cleanPhone, password: inputPassword }));
    setMyProfile({ phone: cleanPhone, name: inputName });
    setView('APP');
  };

  const openSettings = () => {
    setEditName(myProfile.name);
    setView('SETTINGS');
  };

  const saveSettings = async () => {
    setSavingProfile(true);
    let updates = { name: editName };
    if (editWallpaper) {
        const wallRef = ref(storage, `wallpapers/${myProfile.phone}_${Date.now()}`);
        await uploadBytes(wallRef, editWallpaper);
        updates.wallpaper = await getDownloadURL(wallRef);
    }
    await updateDoc(doc(db, "users", myProfile.phone), updates);
    setMyProfile({ ...myProfile, ...updates });
    setSavingProfile(false);
    setView('APP');
  };

  const unfriend = async () => {
    if(!activeFriend) return;
    if(!window.confirm(`DELETE ${activeFriend.name}?`)) return;
    playSound('purge');
    await deleteDoc(doc(db, "users", myProfile.phone, "friends", activeFriend.phone));
    await deleteDoc(doc(db, "users", activeFriend.phone, "friends", myProfile.phone));
    setActiveFriend(null);
    if(isMobile) setMobileView('LIST');
  };

  const wipeChat = async () => {
    if(!activeFriend) return;
    if(!window.confirm("WIPE ALL MESSAGES?")) return;
    playSound('purge');
    const chatId = [myProfile.phone, activeFriend.phone].sort().join("_");
    const q = query(collection(db, "messages"), where("chatId", "==", chatId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
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
        const chatId = [myProfile.phone, activeFriend.phone].sort().join("_");
        await addDoc(collection(db, "messages"), { text: url, type: 'audio', sender: myProfile.phone, chatId, createdAt: serverTimestamp(), isBurn: burnMode });
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const startCall = async (videoMode) => {
    if(!activeFriend) return;
    setIsVideo(videoMode);
    setCallActive(true);
    const callId = `${myProfile.phone}_${activeFriend.phone}_${Date.now()}`;
    setActiveCallId(callId);

    pc.current = new RTCPeerConnection(ICE_SERVERS);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoMode });
    localStream.current = stream;
    if(localVideoRef.current && videoMode) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(t => pc.current.addTrack(t, stream));

    pc.current.ontrack = (e) => { if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    const candidates = [];
    pc.current.onicecandidate = (e) => { if(e.candidate) candidates.push(e.candidate.toJSON()); };

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);

    setTimeout(async () => {
      await setDoc(doc(db, "calls", callId), {
        from: myProfile.phone, to: activeFriend.phone, offer: JSON.stringify(offer),
        type: 'offer', isVideo: videoMode, candidates: JSON.stringify(candidates)
      });
    }, 1000);

    onSnapshot(doc(db, "calls", callId), async (snap) => {
      const data = snap.data();
      if(data?.type === 'answer' && !pc.current.currentRemoteDescription) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.answer)));
        if(data.answerCandidates) JSON.parse(data.answerCandidates).forEach(c => pc.current.addIceCandidate(new RTCIceCandidate(c)));
      }
    });
  };

  const answerCall = async () => {
    if(!incomingCall) return;
    if(ringInterval.current) { clearInterval(ringInterval.current); ringInterval.current = null; }
    setCallActive(true);
    setIsVideo(incomingCall.isVideo);
    setActiveCallId(incomingCall.id);

    pc.current = new RTCPeerConnection(ICE_SERVERS);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.isVideo });
    localStream.current = stream;
    if(localVideoRef.current && incomingCall.isVideo) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(t => pc.current.addTrack(t, stream));

    pc.current.ontrack = (e) => { if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    const candidates = [];
    pc.current.onicecandidate = (e) => { if(e.candidate) candidates.push(e.candidate.toJSON()); };

    await pc.current.setRemoteDescription(new RTCSessionDescription(JSON.parse(incomingCall.offer)));
    if(incomingCall.candidates) JSON.parse(incomingCall.candidates).forEach(c => pc.current.addIceCandidate(new RTCIceCandidate(c)));

    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);

    setTimeout(async () => {
      await updateDoc(doc(db, "calls", incomingCall.id), {
        answer: JSON.stringify(answer), type: 'answer', answerCandidates: JSON.stringify(candidates)
      });
    }, 1000);
    setIncomingCall(null);
  };

  const endCall = async () => {
    if(ringInterval.current) { clearInterval(ringInterval.current); ringInterval.current = null; }
    if(localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    if(pc.current) pc.current.close();
    if(activeCallId) try { await deleteDoc(doc(db, "calls", activeCallId)); } catch(e){}
    setCallActive(false);
    setActiveCallId(null);
    setIncomingCall(null);
  };

  // CHAT LOGIC
  useEffect(() => {
    if(!activeFriend || !myProfile) return;
    const chatId = [myProfile.phone, activeFriend.phone].sort().join("_");
    const q = query(collection(db, "messages"), where("chatId", "==", chatId), orderBy("createdAt", "asc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => d.data());
      setMessages(msgs);
      if(snap.docChanges().some(c => c.type === 'added')) playSound('message');
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 100);
    });
    return () => unsub();
  }, [activeFriend, myProfile]);

  const sendText = async () => {
    if(!inputMsg.trim()) return;
    const chatId = [myProfile.phone, activeFriend.phone].sort().join("_");
    await addDoc(collection(db, "messages"), { text: inputMsg, sender: myProfile.phone, chatId, createdAt: serverTimestamp(), type: 'text', isBurn: burnMode });
    setInputMsg('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeFriend) return;
    const fileRef = ref(storage, `umbra_files/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    const chatId = [myProfile.phone, activeFriend.phone].sort().join("_");
    await addDoc(collection(db, "messages"), { text: url, type: file.type.startsWith('image/') ? 'image' : 'file', sender: myProfile.phone, chatId, createdAt: serverTimestamp(), isBurn: burnMode });
  };

  if(view === 'SETTINGS') {
      return (
        <div style={styles.fullCenter}>
           <div style={styles.loginBox}>
              <h1 style={{color: '#00ff00', fontSize: '24px', marginBottom:'20px'}}>IDENTITY CONFIG</h1>
              <input style={styles.input} placeholder="DISPLAY NAME" value={editName} onChange={e => setEditName(e.target.value)}/>
              <div style={{marginBottom:'20px'}}>
                  <div style={{fontSize:'10px', color:'#00ff00', marginBottom:'5px'}}>CHAT WALLPAPER</div>
                  <input type="file" ref={wallpaperInputRef} hidden onChange={e => setEditWallpaper(e.target.files[0])} accept="image/*" />
                  <button onClick={() => wallpaperInputRef.current.click()} style={{...styles.btn, background:'#111', border:'1px solid #333', fontSize:'12px'}}>
                      {editWallpaper ? 'IMAGE SELECTED' : 'UPLOAD IMAGE'}
                  </button>
              </div>
              <button style={styles.btn} onClick={saveSettings} disabled={savingProfile}>
                  {savingProfile ? 'SAVING...' : 'SAVE CONFIGURATION'}
              </button>
              <button style={{...styles.btn, background:'transparent', color:'#888', marginTop:'10px'}} onClick={() => setView('APP')}>CANCEL</button>
           </div>
        </div>
      );
  }

  if(view === 'LOGIN') {
    return (
      <div style={styles.fullCenter}>
        <div style={styles.loginBox}>
          <img src={APP_LOGO} style={{width:'80px', marginBottom:'15px'}} alt="logo"/>
          <h1 style={{color:'#00ff00', fontSize:'32px', marginBottom:'20px'}}>{LOGIN_TITLE}</h1>
          <input style={styles.input} placeholder="PHONE" value={inputPhone} onChange={e=>setInputPhone(e.target.value)} type="tel"/>
          <input style={styles.input} placeholder="CODENAME" value={inputName} onChange={e=>setInputName(e.target.value)}/>
          <input style={styles.input} placeholder="PASSWORD" type="password" value={inputPassword} onChange={e=>setInputPassword(e.target.value)}/>
          <button style={styles.btn} onClick={handleLogin}>AUTHENTICATE</button>
          {loginError && <div style={{color:'red', marginTop:'10px'}}>{loginError}</div>}
          <div style={styles.copyright}>{COPYRIGHT_TEXT}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <GlitchStyles/>
      
      {incomingCall && !callActive && (
        <div style={styles.modal}>
          <h1 style={{color:'#00ff00', fontSize:'24px', animation:'blink 1s infinite'}}>INCOMING {incomingCall.isVideo?'VIDEO':'AUDIO'} CALL</h1>
          <div style={{fontSize:'18px', color:'white', marginBottom:'20px'}}>{incomingCall.from}</div>
          <div style={{display:'flex', gap:'20px'}}>
            <button style={{...styles.btn, background:'green'}} onClick={answerCall}>ACCEPT</button>
            <button style={{...styles.btn, background:'red'}} onClick={() => { setIncomingCall(null); clearInterval(ringInterval.current); }}>DECLINE</button>
          </div>
        </div>
      )}

      <div style={{...styles.sidebar, display: isMobile && mobileView === 'CHAT' ? 'none' : 'flex'}}>
        <div style={styles.header}>
          <img src={getAvatar(myProfile)} style={styles.avatar} alt="me"/>
          <div style={{flex:1, fontWeight:'bold', cursor:'pointer'}} onClick={openSettings}>{myProfile.name}</div>
          <FaCog style={{color:'#00ff00', cursor:'pointer', marginRight:'10px'}} onClick={openSettings} />
          <FaPowerOff style={{color:'red', cursor:'pointer'}} onClick={() => { localStorage.removeItem('umbra_creds'); window.location.reload(); }}/>
        </div>
        
        <div style={{padding:'10px', display:'flex', gap:'5px', borderBottom:'1px solid #1f1f1f'}}>
          <input style={styles.miniInput} placeholder="ADD PHONE #" value={friendPhone} onChange={e=>setFriendPhone(e.target.value)} type="tel"/>
          <button style={styles.iconBtnSmall} onClick={async () => {
             if(!friendPhone) return;
             await setDoc(doc(db, "users", myProfile.phone, "friends", friendPhone), { phone: friendPhone, name: "New Contact" });
             await setDoc(doc(db, "users", friendPhone, "friends", myProfile.phone), { phone: myProfile.phone, name: myProfile.name });
             setFriendPhone('');
          }}>+</button>
        </div>

        <div style={{flex:1, overflowY:'auto'}}>
          {contacts.map(c => (
            <div key={c.phone} style={{...styles.contactRow, background: activeFriend?.phone === c.phone ? '#111' : 'transparent'}} onClick={() => { setActiveFriend(c); if(isMobile) setMobileView('CHAT'); }}>
              <img src={getAvatar(c)} style={styles.avatar} alt="av"/>
              <div style={{flex:1}}>
                <div style={{fontWeight:'bold'}}>{c.name || c.phone}</div>
                <div style={{display:'flex', alignItems:'center', gap:'5px', fontSize:'10px', marginTop:'2px'}}>
                   {getStatus(c.phone) ? <FaHeart color="#00ff00"/> : <FaHeartBroken color="red"/>}
                   <span style={{color: getStatus(c.phone)?'#00ff00':'red'}}>{getStatus(c.phone)?'ONLINE':'OFFLINE'}</span>
                </div>
              </div>
              <FaChevronRight style={{color:'#00ff00', fontSize:'12px'}}/>
            </div>
          ))}
        </div>
        <div style={styles.copyright}>{COPYRIGHT_TEXT}</div>
      </div>

      <div style={{...styles.main, display: isMobile && mobileView === 'LIST' ? 'none' : 'flex'}}>
        {activeFriend ? (
          <>
            <div style={styles.header}>
              {isMobile && <FaArrowLeft onClick={()=>setMobileView('LIST')} style={{marginRight:'15px', cursor:'pointer'}}/>}
              <div style={{flex:1, fontWeight:'bold', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>{activeFriend.name || activeFriend.phone}</div>
              
              <div style={{display:'flex', gap:'15px', marginRight:'10px'}}>
                <FaUserMinus style={{...styles.actionIcon, color:'orange'}} onClick={unfriend} title="Unfriend" />
                <FaBroom style={{...styles.actionIcon, color:'red'}} onClick={wipeChat} title="Wipe Chat" />
                <FaFire style={{...styles.actionIcon, color: burnMode ? 'orange' : '#333'}} onClick={() => setBurnMode(!burnMode)} title="Burn Mode" />
                <FaPhoneAlt style={styles.actionIcon} onClick={() => startCall(false)}/>
                <FaVideo style={styles.actionIcon} onClick={() => startCall(true)}/>
              </div>
            </div>

            {callActive && (
              <div style={styles.videoContainer}>
                {isVideo ? (
                  <>
                    <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo}/>
                    <div style={styles.localVideoWrapper}>
                        <video ref={localVideoRef} autoPlay playsInline muted style={styles.localVideo}/>
                    </div>
                  </>
                ) : (
                  <div style={styles.audioOnlyUI}>AUDIO LINK ACTIVE</div>
                )}
                <button style={styles.hangupBtn} onClick={endCall}><FaPhoneSlash/></button>
              </div>
            )}

            <div style={styles.chatArea}>
              {messages.map((m, i) => (
                <div key={i} style={{...styles.msg, alignSelf: m.sender === myProfile.phone ? 'flex-end' : 'flex-start', background: m.sender === myProfile.phone ? 'rgba(0, 50, 0, 0.3)' : '#111', borderColor: m.sender === myProfile.phone ? '#004400' : '#333'}}>
                  {m.type === 'text' && <div className="matrix-text">{m.text}</div>}
                  {m.type === 'image' && <img src={m.text} style={{maxWidth:'100%', borderRadius:'5px'}} alt="img"/>}
                  {m.type === 'audio' && <audio src={m.text} controls style={{width:'200px', filter: 'invert(1)'}} />}
                  {m.isBurn && <div style={{fontSize:'10px', color:'orange', marginTop:'5px'}}>🔥 SELF-DESTRUCT</div>}
                </div>
              ))}
              <div ref={messagesEndRef}/>
            </div>

            <div style={styles.inputArea}>
              <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload}/>
              <FaPaperclip style={styles.inputIcon} onClick={() => fileInputRef.current.click()}/>
              <FaMicrophone style={{...styles.inputIcon, color: isRecording ? 'red' : '#00ff00'}} onClick={toggleRecording} />
              <input style={styles.inputBar} value={inputMsg} onChange={e=>setInputMsg(e.target.value)} onKeyPress={e=>e.key==='Enter'&&sendText()} placeholder="MESSAGE..."/>
              <FaSmile style={styles.inputIcon} onClick={() => setInputMsg(prev => prev + "👍")} />
              <button style={styles.sendBtn} onClick={sendText}><FaPaperPlane/></button>
            </div>
          </>
        ) : (
          <div style={styles.emptyState}>SELECT A TARGET</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100%', position: 'fixed', top: 0, left: 0, width: '100%', background: '#080808', color: '#00ff00', fontFamily: 'Courier New, monospace', display: 'flex' },
  fullCenter: { height: '100vh', width: '100vw', display:'flex', alignItems:'center', justifyContent:'center', background:'#050505' },
  loginBox: { border: '1px solid #00ff00', padding: '30px', width:'85%', maxWidth:'350px', textAlign: 'center', background:'#000' },
  input: { display: 'block', width: '100%', padding: '15px', background: '#111', border: '1px solid #333', color: '#00ff00', marginBottom: '15px', boxSizing: 'border-box', outline:'none', fontFamily:'monospace' },
  btn: { width: '100%', padding: '15px', background: '#00ff00', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize:'16px' },
  sidebar: { flex: '0 0 25%', minWidth: '250px', maxWidth: '350px', borderRight: '1px solid #1f1f1f', display: 'flex', flexDirection: 'column', background: '#0a0a0a' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', background: '#050505', position:'relative' },
  header: { padding: '10px', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background:'#000', height:'50px' },
  contactRow: { padding: '15px', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #00ff00' },
  chatArea: { flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundImage: 'linear-gradient(rgba(0,0,0,0.9),rgba(0,0,0,0.9)), url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' },
  msg: { padding: '10px', borderRadius: '2px', maxWidth: '80%', border: '1px solid #333' },
  inputArea: { padding: '10px', borderTop: '1px solid #1f1f1f', display: 'flex', gap: '10px', alignItems: 'center', background:'#0a0a0a' },
  inputBar: { flex: 1, padding: '0 15px', height:'44px', background: '#000', border: '1px solid #333', color: '#fff', outline:'none', fontFamily:'monospace', minWidth:0 },
  sendBtn: { padding: '0 20px', height:'44px', background: '#00ff00', border: 'none', fontWeight: 'bold', cursor:'pointer' },
  miniInput: { flex: 1, padding: '8px', background: '#111', border: '1px solid #333', color: 'white', outline:'none', fontFamily:'monospace' },
  iconBtnSmall: { background: 'transparent', border: 'none', color: '#00ff00', fontSize:'20px', cursor:'pointer' },
  modal: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '24px', letterSpacing:'5px' },
  copyright: { padding: '15px', fontSize: '10.5px', fontWeight: 'bold', color: '#00ff00', textAlign: 'center', fontFamily: 'monospace', borderTop:'1px solid #1f1f1f', background:'#0a0a0a' },
  videoContainer: { height: '300px', background:'#000', borderBottom:'1px solid #00ff00', position:'relative' },
  remoteVideo: { width:'100%', height:'100%', objectFit:'cover' },
  localVideoWrapper: { position:'absolute', bottom:10, right:10, width:'80px', height:'100px', border:'1px solid #00ff00', background:'black' },
  localVideo: { width:'100%', height:'100%', objectFit:'cover' },
  hangupBtn: { position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', background:'red', border:'none', color:'white', width:'50px', height:'50px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', cursor:'pointer' },
  audioOnlyUI: { width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#00ff00', fontSize:'18px', letterSpacing:'2px' },
  inputIcon: { color: '#00ff00', fontSize: '20px', cursor: 'pointer', minWidth:'20px' },
  actionIcon: { color: '#00ff00', fontSize: '18px', cursor: 'pointer' }
};

export default App;