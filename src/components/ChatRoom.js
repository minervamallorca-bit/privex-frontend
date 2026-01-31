import React, { useState, useEffect, useRef } from 'react';
import { decryptMessage } from '../services/encryption'; 
import logo from '../logo.png';

import { 
  Phone, Video, Camera, Paperclip, Trash2, ShieldBan, 
  Lock, Unlock, Mic, Send, User, Users, UserPlus, LogOut, 
  Image as ImageIcon, X, Settings, Bell, BellOff,
  Check, CheckCheck 
} from 'lucide-react';

export default function ChatRoom({ user, logout }) {
  const [text, setText] = useState('');
  const [isDecrypted, setIsDecrypted] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  // --- CORE PROFILE STATE ---
  const [myProfile, setMyProfile] = useState({ 
    name: user?.displayName || 'Privex User', 
    status: 'Online', 
    avatar: logo, // This holds your profile picture
    wallpaper: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop', 
  });

  // --- HANDLER: UPLOAD AVATAR ---
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // This updates the avatar in the UI immediately
        setMyProfile(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // ... (Keep your existing chats mock data and handleSend functions here)
  const [chats, setChats] = useState([
    { id: 1, name: 'Privex AI', lastMsg: 'System Online.', time: 'Now', avatar: '🤖', conversation: [] },
  ]);
  const activeChat = chats[0]; 

  return (
    <div style={styles.appContainer}>

      {/* ================= PROFILE MODAL ================= */}
      {showProfile && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
                <h2 style={{color:'#fff', margin:0, display:'flex', alignItems:'center', gap:'10px'}}>
                  <Settings size={24} color="#ffcc00"/> DIGITAL ID
                </h2>
                <button onClick={() => setShowProfile(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            
            <div style={styles.scrollableForm}>
                {/* AVATAR CHANGE SECTION */}
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'30px'}}>
                    <div style={{position:'relative'}}>
                        <img 
                          src={myProfile.avatar} 
                          alt="Avatar" 
                          style={{width:'120px', height:'120px', borderRadius:'50%', border:'3px solid #ffcc00', objectFit:'cover'}} 
                        />
                        {/* THE CLICKABLE CAMERA ICON */}
                        <label htmlFor="avatar-upload" style={styles.uploadIconBtn}>
                          <Camera size={18} color="#000"/>
                        </label>
                        <input 
                          id="avatar-upload" 
                          type="file" 
                          accept="image/*" 
                          hidden 
                          onChange={handleAvatarChange} 
                        />
                    </div>
                    <p style={{fontSize: '12px', color: '#aaa', marginTop: '10px'}}>Click the icon to update your Identity Photo</p>
                </div>

                <div style={styles.inputGroup}>
                    <label style={styles.label}>Display Name</label>
                    <input 
                      style={styles.modalInput} 
                      value={myProfile.name} 
                      onChange={(e) => setMyProfile({...myProfile, name: e.target.value})}
                    />
                </div>

                <button onClick={() => setShowProfile(false)} style={{...styles.yellowButtonStyle, width:'100%', padding:'15px', marginTop: '20px'}}>
                  CLOSE & SAVE
                </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SIDEBAR (Uses the same avatar) --- */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <img 
            src={myProfile.avatar} 
            alt="User" 
            onClick={() => setShowProfile(true)}
            style={styles.logo3D} 
          />
          <div style={styles.brandTitle}>PrivexApp</div>
        </div>
        {/* ... rest of your sidebar code */}
      </div>

      {/* --- MAIN CHAT --- */}
      <div style={styles.mainChat}>
         {/* ... (Header, MessagesArea, InputBar) */}
         <div style={styles.chatHeader}>
            <div style={styles.headerLeft}>
               <div style={styles.currentAvatar}>{activeChat.avatar}</div>
               <div style={styles.headerName}>{activeChat.name}</div>
            </div>
         </div>
         
         <div style={{...styles.messagesArea, backgroundImage: `url(${myProfile.wallpaper})`}}>
            {/* Messages go here */}
         </div>

         {/* BOTTOM NAV */}
         <div style={styles.bottomNavBar}>
           <button onClick={() => setShowProfile(true)} style={styles.navButton}><User size={18}/> My Profile</button>
           <button onClick={logout} style={{...styles.navButton, color:'#ff3333'}}><LogOut size={18}/> Log Out</button>
         </div>
      </div>
    </div>
  );
}

// --- STYLES (Keep your existing UHD styles) ---
const styles = {
  // ... (Ensure uploadIconBtn is defined as follows)
  uploadIconBtn: { 
    position:'absolute', 
    bottom:'0', 
    right:'0', 
    background:'#ffcc00', 
    width:'36px', 
    height:'36px', 
    borderRadius:'50%', 
    display:'flex', 
    alignItems:'center', 
    justifyContent:'center', 
    cursor:'pointer', 
    border:'3px solid #121212', 
    boxShadow:'0 4px 10px rgba(0,0,0,0.4)' 
  },
  appContainer: { display: 'flex', height: '100vh', width: '100vw', backgroundColor:'#121212', color: 'white' },
  sidebar: { width: '340px', background: '#1a1a1a', display: 'flex', flexDirection: 'column', borderRight: '1px solid #333' },
  sidebarHeader: { padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' },
  logo3D: { width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', border: '2px solid #ffcc00' },
  brandTitle: { fontSize: '20px', fontWeight: 'bold' },
  mainChat: { flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' },
  chatHeader: { height: '70px', background: '#222', display: 'flex', alignItems: 'center', padding: '0 20px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '15px' },
  currentAvatar: { fontSize: '24px' },
  headerName: { fontWeight: 'bold' },
  messagesArea: { flex: 1, backgroundSize: 'cover', position: 'relative' },
  bottomNavBar: { height: '60px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-around', alignItems: 'center' },
  navButton: { background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalContent: { background: '#222', borderRadius: '20px', width: '400px', overflow: 'hidden' },
  modalHeader: { padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' },
  scrollableForm: { padding: '20px' },
  inputGroup: { marginBottom: '15px' },
  label: { display: 'block', color: '#888', marginBottom: '5px', fontSize: '12px' },
  modalInput: { width: '100%', background: '#333', border: 'none', padding: '10px', color: 'white', borderRadius: '8px' },
  closeBtn: { background: 'none', border: 'none', color: 'white', cursor: 'pointer' },
  yellowButtonStyle: { background: '#ffcc00', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }
};