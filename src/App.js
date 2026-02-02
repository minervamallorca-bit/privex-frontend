import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, setDoc, doc, getDoc, deleteDoc, updateDoc, where, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ---------------------------------------------------------
// 1. UTILS
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

// V28.1: CRASH-PROOF AVATAR
const getAvatar = (user) => {
    if (!user) return `https://api.dicebear.com/7.x/bottts/svg?seed=Unknown&backgroundColor=transparent`;
    if (user.avatar) return user.avatar;
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name || 'User'}&backgroundColor=transparent`;
};

// ---------------------------------------------------------
// 2. MAIN APP: UMBRA V28.1 (ROBUST PROFILE)
// ---------------------------------------------------------
function App() {
  // STATE
  const [view, setView] = useState('LOGIN'); 
  const [mobileView, setMobileView] = useState('LIST'); 
  const [myProfile, setMyProfile] = useState(null); 
  const [activeFriend, setActiveFriend] = useState(null); 
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  
  // LOGIN INPUTS
  const [inputPhone, setInputPhone] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [saveLogin, setSaveLogin] = useState(false);
  const [friendPhone, setFriendPhone] = useState('');
  const [addStatus, setAddStatus] = useState('');
  const [loginError, setLoginError] = useState('');

  // PROFILE EDIT STATE
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAvatar, setEditAvatar] = useState(null);
  const [editWallpaper, setEditWallpaper] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // RECOVERY
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // CHAT
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('IDLE');
  const [isVideoCall, setIsVideoCall] = useState(true);
  
  const [burnMode, setBurnMode] = useState(false); 
  const [isRecording, setIsRecording] = useState(false); 
  const [time, setTime] = useState(Date.now()); 
  
  // REFS
  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);
  const localStream = useRef(null);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // AUTO LOGIN
  useEffect(() => {
    const storedCreds = localStorage.getItem('umbra_creds');
    if (storedCreds) {
      const { phone, password } = JSON.parse(storedCreds);
      const autoLogin = async () => {
        try {
            const userDocRef = doc(db, "users", phone);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists() && userSnap.data().password === password) {
               setMyProfile({ ...userSnap.data(), phone });
               setView('APP');
            }
        } catch(e) {}
      };
      autoLogin();
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const cleanPhone = inputPhone.replace(/\D/g, ''); 
    if (cleanPhone.length < 5 || !inputName.trim() || !inputPassword.trim()) {
        setLoginError('INVALID INPUTS'); return;
    }
    const userDocRef = doc(db, "users", cleanPhone);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      await setDoc(userDocRef, { phone: cleanPhone, name: inputName, password: inputPassword, createdAt: serverTimestamp() });
    } else {
      if (userSnap.data().password !== inputPassword) { setLoginError('WRONG PASSWORD'); return; }
      if (userSnap.data().name !== inputName) await updateDoc(userDocRef, { name: inputName });
    }
    if (saveLogin) localStorage.setItem('umbra_creds', JSON.stringify({ phone: cleanPhone, password: inputPassword }));
    else localStorage.removeItem('umbra_creds');
    
    const fullProfile = (await getDoc(userDocRef)).data();
    setMyProfile({ ...fullProfile, phone: cleanPhone });
    setView('APP');
  };

  const handleLogout = () => {
    playSound('purge');
    localStorage.removeItem('umbra_creds');
    setView('LOGIN');
    setMyProfile(null);
    setMessages([]);
    setActiveFriend(null);
  };

  const openSettings = () => {
      if (!myProfile) return;
      setEditName(myProfile.name || '');
      setEditEmail(myProfile.email || '');
      setEditLocation(myProfile.location || '');
      setEditAvatar(null);
      setEditWallpaper(null);
      setView('SETTINGS');
  };

  const saveProfile = async () => {
      setSavingProfile(true);
      let updates = { name: editName, email: editEmail, location: editLocation };
      
      if (editAvatar) {
          const avatarRef = ref(storage, `avatars/${myProfile.phone}_${Date.now()}`);
          await uploadBytes(avatarRef, editAvatar);
          updates.avatar = await getDownloadURL(avatarRef);
      }

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

  // RECOVERY & DATA LISTENERS (Standard)
  const initRecovery = async () => {
      const cleanPhone = inputPhone.replace(/\D/g, '');
      if (cleanPhone.length < 5) { setLoginError('ENTER VALID PHONE'); return; }
      const userDocRef = doc(db, "users", cleanPhone);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) { setLoginError('USER NOT FOUND'); return; }
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setRecoveryCode(code);
      setRecoveryStep(2);
      alert(`[UMBRA NETWORK]\n\nRECOVERY CODE: ${code}`);
  };

  const completeRecovery = async () => {
      if (inputCode !== recoveryCode) { setLoginError('INVALID CODE'); return; }
      if (!newPassword.trim()) { setLoginError('ENTER NEW PASSWORD'); return; }
      const cleanPhone = inputPhone.replace(/\D/g, '');
      await updateDoc(doc(db, "users", cleanPhone), { password: newPassword });
      alert("PASSWORD UPDATED. PLEASE LOGIN.");
      setView('LOGIN');
      setRecoveryStep(1);
      setInputPassword('');
      setLoginError('');
  };

  useEffect(() => {
    if (!myProfile) return;
    const qReq = query(collection(db, "friend_requests"), where("to", "==", myProfile.phone), where("status", "==", "pending"));
    const unsubReq = onSnapshot(qReq, (snap) => {
       setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
       if(!snap.empty) playSound('ping');
    });
    const qContacts = query(collection(db, "users", myProfile.phone, "friends"));
    const unsubContacts = onSnapshot(qContacts, (snap) => {
       setContacts(snap.docs.map(d => d.data()));
    });
    return () => { unsubReq(); unsubContacts(); };
  }, [myProfile]);

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

  // FRIENDSHIP & CHAT
  const sendFriendRequest = async () => {
    const targetPhone = friendPhone.replace(/\D/g, '');
    if (targetPhone === myProfile.phone) return setAddStatus("CANNOT ADD SELF");
    const targetDoc = await getDoc(doc(db, "users", targetPhone));
    if (!targetDoc.exists()) { setAddStatus("USER NOT FOUND"); return; }
    await addDoc(collection(db, "friend_requests"), { from: myProfile.phone, fromName: myProfile.name, to: targetPhone, status: 'pending', createdAt: serverTimestamp() });
    setAddStatus("REQUEST SENT");
    setFriendPhone('');
  };

  const acceptRequest = async (req) => {
    await setDoc(doc(db, "users", myProfile.phone, "friends", req.from), { phone: req.from, name: req.fromName });
    await setDoc(doc(db, "users", req.from, "friends", myProfile.phone), { phone: myProfile.phone, name: myProfile.name });
    await deleteDoc(doc(db, "friend_requests", req.id));
  };

  const getChatID = (phoneA, phoneB) => parseInt(phoneA) < parseInt(phoneB) ? `${phoneA}_${phoneB}` : `${phoneB}_${phoneA}`;
  const selectFriend = (friend) => { setActiveFriend(friend); if (isMobile) setMobileView('CHAT'); };
  const goBack = () => { setMobileView('LIST'); if (!isMobile) setActiveFriend(null); };

  useEffect(() => {
    if (!activeFriend || !myProfile) return;
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    const q = query(collection(db, "messages"), where("channel", "==", chatID), limit(100));
    const unsub = onSnapshot(q, (snap) => {
       let msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       msgs.sort((a, b) => (a.createdAt?.seconds || Date.now()) - (b.createdAt?.seconds || Date.now()));
       setMessages(msgs);
       setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
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
    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    if (file.type.startsWith('video/')) type = 'video_file';
    let msgData = { text: url, type: type, sender: myProfile.phone, senderName: myProfile.name, channel: chatID, createdAt: serverTimestamp() };
    if (burnMode) { msgData.burnAt = Date.now() + 60000; msgData.isBurn = true; }
    await addDoc(collection(db, "messages"), msgData);
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
        const chatID = getChatID(myProfile.phone, activeFriend.phone);
        let msgData = { text: url, type: 'audio', sender: myProfile.phone, senderName: myProfile.name, channel: chatID, createdAt: serverTimestamp() };
        if (burnMode) { msgData.burnAt = Date.now() + 60000; msgData.isBurn = true; }
        await addDoc(collection(db, "messages"), msgData);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const shareMessage = async (msg) => {
      const data = msg.text; 
      if (navigator.share) {
          try { await navigator.share({ title: 'UMBRA', text: data, url: msg.type !== 'text' ? data : null }); } catch(e){}
      } else {
          navigator.clipboard.writeText(data);
          alert('COPIED');
      }
  };

  const saveMessage = (msg) => {
      const link = document.createElement("a");
      if (msg.type === 'text') {
          const file = new Blob([msg.text], { type: 'text/plain' });
          link.href = URL.createObjectURL(file);
          link.download = `umbra_log_${Date.now()}.txt`;
      } else {
          link.href = msg.text;
          link.download = `umbra_file_${Date.now()}`;
          link.target = "_blank";
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const wipeChat = async () => {
    if (!window.confirm("CONFIRM WIPE?")) return;
    playSound('purge');
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    const q = query(collection(db, "messages"), where("channel", "==", chatID));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
    await batch.commit();
  };

  const startCall = async (mode) => {
    setCallActive(true); setCallStatus('DIALING...'); setIsVideoCall(mode === 'video');
    const constraints = { audio: true, video: mode === 'video' ? { width: 640 } : false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.current = stream;
    if (localVideoRef.current && mode === 'video') localVideoRef.current.srcObject = stream;
    pc.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun1.l.google.com:19302' }] });
    stream.getTracks().forEach(t => pc.current.addTrack(t, stream));
    pc.current.ontrack = e => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    await setDoc(doc(db, "calls", chatID), { type: 'offer', sdp: JSON.stringify(offer), sender: myProfile.phone, mode: mode });
  };

  const answerCall = async () => {
    setCallActive(true);
    const chatID = getChatID(myProfile.phone, activeFriend.phone);
    const callDoc = await getDoc(doc(db, "calls", chatID));
    const data = callDoc.data();
    const offer = JSON.parse(data.sdp);
    const incomingMode = data.mode || 'video';
    setIsVideoCall(incomingMode === 'video');
    const constraints = { audio: true, video: incomingMode === 'video' ? { width: 640 } : false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.current = stream;
    if (localVideoRef.current && incomingMode === 'video') localVideoRef.current.srcObject = stream;
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
              setCallStatus(data.mode === 'audio' ? 'INCOMING VOICE...' : 'INCOMING VIDEO...');
              playSound('ring');
          }
          if (data && data.type === 'answer' && callActive && pc.current) await pc.current.setRemoteDescription(JSON.parse(data.sdp));
          if (!data && callActive) { setCallActive(false); if(localStream.current) localStream.current.getTracks().forEach(t => t.stop()); }
      });
      return () => unsub();
  }, [activeFriend, callActive]);

  // --- RENDERERS ---

  if (view === 'RECOVERY') {
      return (
        <div style={styles.fullCenter}>
           <div style={styles.loginBox}>
              <h1 style={{color: 'orange', fontSize: '32px', marginBottom:'20px'}}>RECOVERY</h1>
              {recoveryStep === 1 ? (
                  <>
                    <input style={styles.input} placeholder="PHONE NUMBER" value={inputPhone} onChange={e => setInputPhone(e.target.value)} type="tel"/>
                    <button style={styles.btn} onClick={initRecovery}>SEND CODE</button>
                  </>
              ) : (
                  <>
                    <input style={styles.input} placeholder="CODE" value={inputCode} onChange={e => setInputCode(e.target.value)} type="tel"/>
                    <input style={styles.input} placeholder="NEW PASSWORD" value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password"/>
                    <button style={styles.btn} onClick={completeRecovery}>RESET</button>
                  </>
              )}
              <button style={{...styles.btn, background:'transparent', color:'#888', marginTop:'10px'}} onClick={() => { setView('LOGIN'); setRecoveryStep(1); }}>CANCEL</button>
           </div>
        </div>
      );
  }

  // SETTINGS VIEW
  if (view === 'SETTINGS') {
      return (
        <div style={styles.fullCenter}>
           <div style={styles.loginBox}>
              <h1 style={{color: '#00ff00', fontSize: '24px', marginBottom:'20px'}}>IDENTITY CONFIG</h1>
              
              <div style={{display:'flex', gap:'10px', alignItems:'center', marginBottom:'15px'}}>
                  <img src={editAvatar ? URL.createObjectURL(editAvatar) : getAvatar(myProfile)} style={{width:'50px', height:'50px', borderRadius:'50%', border:'1px solid #00ff00'}} alt="avatar" />
                  <input type="file" ref={avatarInputRef} hidden onChange={e => setEditAvatar(e.target.files[0])} accept="image/*" />
                  <button onClick={() => avatarInputRef.current.click()} style={{...styles.tinyBtn, width:'auto', padding:'5px 10px'}}>UPLOAD AVATAR</button>
              </div>

              <input style={styles.input} placeholder="DISPLAY NAME" value={editName} onChange={e => setEditName(e.target.value)}/>
              <input style={styles.input} placeholder="EMAIL" value={editEmail} onChange={e => setEditEmail(e.target.value)}/>
              <input style={styles.input} placeholder="CITY / COUNTRY" value={editLocation} onChange={e => setEditLocation(e.target.value)}/>
              
              <div style={{marginBottom:'20px'}}>
                  <div style={{fontSize:'10px', color:'#00ff00', marginBottom:'5px'}}>CHAT WALLPAPER</div>
                  <input type="file" ref={wallpaperInputRef} hidden onChange={e => setEditWallpaper(e.target.files[0])} accept="image/*" />
                  <button onClick={() => wallpaperInputRef.current.click()} style={{...styles.btn, background:'#111', border:'1px solid #333', fontSize:'12px'}}>
                      {editWallpaper ? 'IMAGE SELECTED' : 'UPLOAD IMAGE'}
                  </button>
              </div>

              <button style={styles.btn} onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? 'SAVING...' : 'SAVE CONFIGURATION'}
              </button>
              <button style={{...styles.btn, background:'transparent', color:'#888', marginTop:'10px'}} onClick={() => setView('APP')}>CANCEL</button>
           </div>
        </div>
      );
  }

  if (view === 'LOGIN') {
     return (
        <div style={styles.fullCenter}>
           <div style={styles.loginBox}>
              <h1 style={{color: '#00ff00', fontSize: '32px', marginBottom:'20px'}}>UMBRA</h1>
              <div style={{color: '#00ff00', fontSize:'12px', marginBottom:'20px'}}>SECURE VAULT V28.1</div>
              <input style={styles.input} placeholder="PHONE NUMBER" value={inputPhone} onChange={e => setInputPhone(e.target.value)} type="tel"/>
              <input style={styles.input} placeholder="CODENAME" value={inputName} onChange={e => setInputName(e.target.value)}/>
              <input style={styles.input} placeholder="PASSWORD" value={inputPassword} onChange={e => setInputPassword(e.target.value)} type="password"/>
              <div style={{display:'flex', justifyContent:'center', gap:'10px', marginBottom:'15px'}}>
                  <input type="checkbox" checked={saveLogin} onChange={() => setSaveLogin(!saveLogin)} style={{accentColor:'#00ff00'}}/> 
                  <span style={{color:'#fff', fontSize:'12px'}}>SAVE LOGIN</span>
              </div>
              {loginError && <div style={{color:'red', fontSize:'12px', marginBottom:'10px'}}>{loginError}</div>}
              <button style={styles.btn} onClick={handleLogin}>AUTHENTICATE</button>
              <div style={{marginTop:'15px', cursor:'pointer', fontSize:'10px', color:'#555', textDecoration:'underline'}} onClick={() => setView('RECOVERY')}>LOST ACCESS?</div>
           </div>
        </div>
     );
  }

  return (
    <div style={styles.container}>
      <div style={{...styles.sidebar, display: isMobile && mobileView === 'CHAT' ? 'none' : 'flex'}}>
          
          {/* V28.1: CLICKABLE PROFILE HEADER */}
          <div style={styles.sideHeader} onClick={openSettings} title="Click to Edit Profile">
             <img src={getAvatar(myProfile)} style={{width:'35px', height:'35px', borderRadius:'50%', border:'1px solid #00ff00', marginRight:'10px'}} alt="me"/>
             <div style={{flex:1, minWidth:0, cursor:'pointer'}}>
                 <div style={styles.truncatedText}>{myProfile.name}</div>
                 <div style={{fontSize:'10px'}}>{myProfile.phone}</div>
             </div>
             
             {/* SETTINGS + LOGOUT ICONS */}
             <button style={{...styles.iconBtnSmall, color:'#00ff00', marginRight:'5px'}}>⚙️</button>
             <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} style={{...styles.iconBtnSmall, color:'red', borderColor:'#333'}}>⏻</button>
          </div>

          <div style={styles.addSection}>
              <div style={{display:'flex', gap:'5px'}}>
                  <input style={styles.miniInput} placeholder="ADD PHONE #" value={friendPhone} onChange={e => setFriendPhone(e.target.value)} type="tel"/>
                  <button onClick={sendFriendRequest} style={styles.iconBtnSmall}>+</button>
              </div>
              {addStatus && <div style={{fontSize:'10px', color:'orange', marginTop:'5px'}}>{addStatus}</div>}
          </div>
          {requests.length > 0 && (
             <div style={{padding:'10px', background:'#221100'}}>
                 <div style={{fontSize:'9px', color:'orange'}}>PENDING REQUESTS</div>
                 {requests.map(req => (
                     <div key={req.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'5px'}}>
                         <span style={{fontSize:'12px'}}>{req.fromName}</span>
                         <button style={styles.tinyBtn} onClick={() => acceptRequest(req)}>ACCEPT</button>
                     </div>
                 ))}
             </div>
          )}
          <div style={{flex:1, overflowY:'auto'}}>
              {contacts.map(c => (
                  <div key={c.phone} onClick={() => selectFriend(c)} style={{...styles.contactRow, background: activeFriend?.phone === c.phone ? '#111' : 'transparent'}}>
                      <img src={getAvatar(c)} style={styles.avatar} alt="av"/>
                      <div style={{flex:1, minWidth:0}}><div style={styles.contactName}>{c.name}</div><div style={{fontSize:'10px', opacity:0.6}}>{c.phone}</div></div>
                      <div style={{color:'#00ff00'}}>➤</div>
                  </div>
              ))}
          </div>
      </div>

      <div style={{...styles.main, display: isMobile && mobileView === 'LIST' ? 'none' : 'flex'}}>
          {activeFriend ? (
              <div style={styles.chatContainer}>
                <div style={styles.chatHeader}>
                    {isMobile && <button onClick={goBack} style={{...styles.iconBtn, marginRight:'10px'}}>←</button>}
                    <div style={{flex:1, overflow:'hidden'}}>
                        <div style={styles.truncatedText}>{activeFriend.name}</div>
                        <div style={{fontSize:'10px', color: callStatus.includes('INCOMING') ? 'orange' : '#00ff00'}}>{callStatus === 'IDLE' ? 'SECURE' : callStatus}</div>
                    </div>
                    <div style={{display:'flex', gap:'5px'}}>
                        <button onClick={wipeChat} style={{...styles.iconBtn, color:'#FF0000', borderColor:'#333'}}>🗑️</button>
                        <button onClick={() => setBurnMode(!burnMode)} style={{...styles.iconBtn, color: burnMode ? 'black' : 'orange', background: burnMode ? 'orange' : 'transparent', borderColor: 'orange'}}>🔥</button>
                        {!callActive && (<><button onClick={() => startCall('audio')} style={styles.iconBtn}>📞</button><button onClick={() => startCall('video')} style={styles.iconBtn}>🎥</button></>)}
                        {callStatus.includes('INCOMING') && <button onClick={answerCall} style={{...styles.iconBtn, background:'#00ff00', color:'black'}}>📞</button>}
                        {callActive && <button onClick={endCall} style={{...styles.iconBtn, color:'red', borderColor:'red'}}>X</button>}
                    </div>
                </div>

                {callActive && isVideoCall && (
                    <div style={{height: '200px', background: '#000', position:'relative', borderBottom:'1px solid #00ff00', flexShrink:0}}>
                        <video ref={remoteVideoRef} autoPlay playsInline style={{width:'100%', height:'100%', objectFit:'cover'}} />
                        <div style={{position:'absolute', bottom:'10px', right:'10px', width:'80px', height:'100px', border:'1px solid #00ff00', background:'black'}}>
                            <video ref={localVideoRef} autoPlay playsInline muted style={{width:'100%', height:'100%', objectFit:'cover'}} />
                        </div>
                    </div>
                )}
                {callActive && !isVideoCall && (
                     <div style={{height: '50px', background: '#000', display:'flex', alignItems:'center', justifyContent:'center', color:'#00ff00', borderBottom:'1px solid #00ff00', fontSize:'12px'}}>AUDIO LINK ACTIVE</div>
                )}

                <div style={{...styles.chatArea, backgroundImage: myProfile.wallpaper ? `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url(${myProfile.wallpaper})` : styles.chatArea.backgroundImage, backgroundSize: 'cover' }}>
                    {messages.map(msg => {
                        let timeLeft = null;
                        if (msg.burnAt) timeLeft = Math.max(0, Math.ceil((msg.burnAt - time) / 1000));
                        return (
                           <div key={msg.id} style={{display:'flex', justifyContent: msg.sender === myProfile.phone ? 'flex-end' : 'flex-start', marginBottom:'10px'}}>
                               <div style={{...(msg.sender === myProfile.phone ? styles.myMsg : styles.otherMsg), borderColor: timeLeft ? 'orange' : (msg.sender === myProfile.phone ? '#004400' : '#333')}}>
                                   {msg.type === 'text' && msg.text}
                                   {msg.type === 'image' && <img src={msg.text} style={{maxWidth:'100%', borderRadius:'5px'}} alt="msg"/>}
                                   {msg.type === 'video_file' && <video src={msg.text} controls style={{maxWidth:'100%', borderRadius:'5px'}} />}
                                   {msg.type === 'audio' && <audio src={msg.text} controls style={{width:'200px', filter: 'invert(1)'}} />}
                                   <div style={styles.msgFooter}>
                                       {timeLeft !== null ? <span style={{color:'orange'}}>🔥 {timeLeft}s</span> : <span></span>}
                                       <div style={{display:'flex', gap:'8px'}}><span onClick={() => shareMessage(msg)} style={{cursor:'pointer', fontSize:'12px'}}>🔗</span><span onClick={() => saveMessage(msg)} style={{cursor:'pointer', fontSize:'12px'}}>💾</span></div>
                                   </div>
                               </div>
                           </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                <div style={styles.inputArea}>
                    <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current.click()} style={styles.iconBtn}>📎</button>
                    <button onClick={toggleRecording} style={{...styles.iconBtn, color: isRecording ? 'red' : '#00ff00', borderColor: isRecording ? 'red' : '#333'}}>{isRecording ? '⏹' : '🎤'}</button>
                    <input value={input} onChange={e => setInput(e.target.value)} placeholder="MESSAGE..." style={styles.inputBar} onKeyPress={e => e.key === 'Enter' && sendMessage()}/>
                    <button onClick={sendMessage} style={styles.sendBtn}>SEND</button>
                </div>
              </div>
          ) : (
              <div style={styles.emptyState}><h1 style={{fontSize:'40px', opacity:0.3}}>UMBRA</h1><div>SELECT A CONTACT</div></div>
          )}
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100%', position: 'fixed', top: 0, left: 0, width: '100%', background: '#080808', color: '#00ff00', fontFamily: 'Courier New, monospace', display: 'flex' },
  fullCenter: { height: '100vh', width: '100vw', display:'flex', alignItems:'center', justifyContent:'center', background:'#080808' },
  loginBox: { border: '1px solid #00ff00', padding: '30px', width:'85%', maxWidth:'350px', textAlign: 'center', background: '#000' },
  input: { display: 'block', width: '100%', boxSizing:'border-box', background: '#0a0a0a', border: '1px solid #333', color: '#00ff00', padding: '15px', fontSize: '16px', outline: 'none', fontFamily:'monospace', marginBottom:'15px' },
  btn: { background: '#00ff00', color: 'black', border: 'none', padding: '15px', width: '100%', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' },
  sidebar: { flex: '0 0 25%', minWidth: '250px', maxWidth: '350px', borderRight: '1px solid #1f1f1f', display: 'flex', flexDirection: 'column', background:'#0a0a0a', height:'100%' },
  sideHeader: { padding: '10px', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background:'#000', cursor:'pointer' },
  addSection: { padding: '10px', borderBottom: '1px solid #1f1f1f' },
  miniInput: { flex: 1, background: '#111', border: '1px solid #333', color: '#fff', padding: '8px', fontFamily: 'monospace', outline: 'none', fontSize: '12px' },
  tinyBtn: { background: '#00ff00', color:'black', border:'none', fontSize:'9px', padding:'3px 6px', cursor:'pointer' },
  contactRow: { display:'flex', alignItems:'center', gap:'10px', padding:'10px', borderBottom:'1px solid #1f1f1f', cursor:'pointer' },
  avatar: { width:'35px', height:'35px', borderRadius:'50%', border:'1px solid #00ff00', flexShrink: 0 },
  truncatedText: { fontWeight:'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  contactName: { fontWeight:'bold', fontSize:'14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', background:'#050505', minWidth: 0, position: 'relative', height: '100%' },
  chatContainer: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%' },
  chatHeader: { padding: '10px', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background:'#0a0a0a', flexShrink: 0 },
  chatArea: { flex: 1, overflowY: 'auto', padding: '15px', backgroundImage: 'linear-gradient(rgba(0,0,0,0.95),rgba(0,0,0,0.95)), url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' },
  inputArea: { padding: '10px', borderTop: '1px solid #1f1f1f', display: 'flex', gap: '8px', alignItems: 'center', background:'#0a0a0a', flexShrink: 0 },
  inputBar: { flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '0 12px', height: '44px', lineHeight: '44px', fontFamily: 'monospace', outline: 'none', borderRadius: '2px', minWidth: 0 },
  iconBtn: { background: 'black', border: '1px solid #333', borderRadius: '2px', width: '44px', height: '44px', minWidth: '44px', fontSize: '18px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBtnSmall: { background: 'black', border: '1px solid #333', borderRadius: '2px', width: '35px', height: '35px', fontSize: '16px', cursor: 'pointer', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sendBtn: { background: '#00ff00', color: 'black', border: 'none', padding: '0 15px', height: '44px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', flexShrink: 0 },
  myMsg: { background: 'rgba(0, 50, 0, 0.3)', border: '1px solid #004400', padding: '10px', borderRadius: '2px', maxWidth: '85%', color: '#e0ffe0', wordWrap: 'break-word' },
  otherMsg: { background: '#111', border: '1px solid #333', padding: '10px', borderRadius: '2px', maxWidth: '85%', color: '#ccc', wordWrap: 'break-word' },
  emptyState: { flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#333' },
  msgFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid rgba(0,255,0,0.1)', paddingTop: '5px', opacity: 0.8 }
};

export default App;