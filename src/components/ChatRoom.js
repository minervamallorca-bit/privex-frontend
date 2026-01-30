import React, { useState, useEffect, useRef } from 'react';
import { decryptMessage } from '../services/encryption'; 
import logo from '../logo.png';

// IMPORT MODERN ICONS
import { 
  Phone, Video, Camera, Paperclip, Trash2, ShieldBan, 
  Lock, Unlock, Mic, Send, User, Users, UserPlus, LogOut, 
  Image as ImageIcon, X, Settings, Bell, BellOff,
  Check, CheckCheck 
} from 'lucide-react';

// --- SOUND ASSETS ---
const SOUNDS = {
  incomingMsg: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
  outgoingMsg: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
  calling: 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3',
};

export default function ChatRoom({ user, logout }) {
  const [text, setText] = useState('');
  const [isDecrypted, setIsDecrypted] = useState(false);

  // UI States
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // PROFILE STATE
  const [myProfile, setMyProfile] = useState({ 
    name: user?.displayName || 'Privex User', 
    status: 'Online', 
    email: 'user@privex.app',
    birthDate: '',
    avatar: logo,
    wallpaper: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop', 
    blockedUsers: [] 
  });

  // MOCK DATA
  const [chats, setChats] = useState([
    { 
      id: 1, name: 'Privex AI', lastMsg: 'System Online.', time: 'Now', unread: 0, avatar: '🤖',
      conversation: [
        { id: 1, sender: 'System', text: 'System Online. 8K Mode Active.', time: '10:00 AM', status: 'read' },
        { id: 2, sender: 'System', text: 'Audio Module Loaded.', time: '10:01 AM', status: 'read' }
      ]
    },
    { 
      id: 2, name: 'Team Alpha', lastMsg: 'Uploading assets...', time: '10:30', unread: 2, avatar: '👥',
      conversation: [
        { id: 1, sender: 'Me', text: 'Are the 8K assets ready?', time: '09:45 AM', status: 'read' },
        { id: 2, sender: 'Team Alpha', text: 'Uploading assets now...', time: '10:30 AM', status: 'read' }
      ]
    },
    { 
      id: 3, name: 'Alice Smith', lastMsg: 'Secured channel.', time: 'Yest', unread: 0, avatar: '👤',
      conversation: [
        { id: 1, sender: 'Alice Smith', text: 'Hey, is this line secured?', time: 'Yesterday', status: 'read' },
        { id: 2, sender: 'Me', text: 'Yes, encryption is on.', time: 'Yesterday', status: 'read' }
      ]
    },
    { 
      id: 4, name: 'Visual Dept', lastMsg: 'Rendering complete.', time: 'Mon', unread: 1, avatar: '📢',
      conversation: [
        { id: 1, sender: 'Visual Dept', text: 'Rendering complete.', time: 'Mon', status: 'read' }
      ] 
    },
    { 
      id: 5, name: 'John Doe', lastMsg: 'File transfer: 100%', time: 'Sun', unread: 0, avatar: '👤',
      conversation: [
        { id: 1, sender: 'John Doe', text: 'Sending the classified file.', time: 'Sun', status: 'read' },
        { id: 2, sender: 'John Doe', text: 'File transfer: 100%', time: 'Sun', status: 'read' }
      ]
    },
  ]);

  const [activeChatId, setActiveChatId] = useState(1);
  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(scrollToBottom, [activeChat, showChatOnMobile]); 

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  // --- SOUND SYSTEM ---
  const playSound = (type) => {
    if (!soundEnabled) return; 
    const audio = new Audio(SOUNDS[type]);
    audio.volume = 0.5;
    audio.play().catch(error => console.log("Audio play failed:", error));
  };

  // --- ACTIONS ---

  const handleChatClick = (id) => {
    setActiveChatId(id);
    if (isMobile) setShowChatOnMobile(true);
  };

  const handleSend = () => {
    if (!text.trim()) return;
    playSound('outgoingMsg');

    const msgId = Date.now(); 

    const newMessage = { 
        id: msgId,
        sender: 'Me', 
        text: text, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent' 
    };

    setChats(prevChats => prevChats.map(chat => {
        if (chat.id === activeChatId) {
            return {
                ...chat,
                conversation: [...chat.conversation, newMessage],
                lastMsg: text,
                time: 'Just now'
            };
        }
        return chat;
    }));

    setText('');

    setTimeout(() => {
        setChats(prevChats => prevChats.map(chat => {
            if (chat.id === activeChatId) {
                return {
                    ...chat,
                    conversation: chat.conversation.map(msg => 
                        msg.id === msgId ? { ...msg, status: 'read' } : msg
                    )
                };
            }
            return chat;
        }));
    }, 1500);
  };

  const handleVoiceMessage = () => {
      playSound('outgoingMsg');
      const msgId = Date.now();
      const msg = "🎤 Voice Note (Lossless)";
      const newMessage = { id: msgId, sender:'Me', text: msg, time: 'Just now', status: 'sent'};
      
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === activeChatId) {
            return { ...chat, conversation: [...chat.conversation, newMessage], lastMsg: msg, time: 'Just now' };
        }
        return chat;
      }));

      setTimeout(() => {
        setChats(prevChats => prevChats.map(chat => {
            if (chat.id === activeChatId) {
                return {
                    ...chat,
                    conversation: chat.conversation.map(m => m.id === msgId ? { ...m, status: 'read' } : m)
                };
            }
            return chat;
        }));
      }, 1500);
  };

  const handleAttachment = (type) => {
      playSound('outgoingMsg');
      const msgId = Date.now();
      const msg = type === 'photo' ? "📷 IMG_8K_RAW.tiff" : "📄 Classified_Doc.pdf";
      const newMessage = { id: msgId, sender:'Me', text: msg, time: 'Just now', status: 'sent'};
      
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === activeChatId) {
            return { ...chat, conversation: [...chat.conversation, newMessage], lastMsg: msg, time: 'Just now' };
        }
        return chat;
      }));

      setTimeout(() => {
        setChats(prevChats => prevChats.map(chat => {
            if (chat.id === activeChatId) {
                return {
                    ...chat,
                    conversation: chat.conversation.map(m => m.id === msgId ? { ...m, status: 'read' } : m)
                };
            }
            return chat;
        }));
      }, 1500);
  };

  const handleCall = (type) => {
    playSound('calling');
    alert(`Initiating ${type} Uplink with ${activeChat?.name}...\n\n(Ringing...)`);
  };
  
  const handleCreateGroup = () => {
    const group = prompt("Enter Group Name:");
    if (group) setChats([{ id: Date.now(), name: group, lastMsg: 'Channel Created', time: 'Now', unread: 0, avatar: '📢', conversation: [] }, ...chats]);
  };

  const handleAddFriend = () => {
    const phone = prompt("Enter the Phone Number to invite:");
    if (phone && phone.length > 3) {
        alert(`📡 Invitation sent to ${phone}.\n\nWaiting for user to accept...`);
        
        setTimeout(() => {
            playSound('incomingMsg');
            const newFriend = { 
                id: Date.now(), 
                name: `User ${phone}`, 
                lastMsg: '👋 Request Accepted!', 
                time: 'Just now', 
                unread: 1, 
                avatar: '👤',
                conversation: [{ id: Date.now(), sender: `User ${phone}`, text: "👋 Request Accepted!", time: 'Just now', status:'read' }] 
            };
            setChats(prev => [newFriend, ...prev]);
            alert(`✅ ${phone} accepted your request!`);
        }, 3000); 
    }
  };

  const handleDeleteFriend = () => {
    if (!activeChat) return;
    const confirmDelete = window.confirm(`Terminate connection with ${activeChat.name}?`);
    if (confirmDelete) {
      const updatedChats = chats.filter(c => c.id !== activeChatId);
      setChats(updatedChats);
      if (updatedChats.length > 0) setActiveChatId(updatedChats[0].id);
      if (isMobile) setShowChatOnMobile(false);
    }
  };

  const handleBlockUser = () => {
    if(!activeChat) return;
    const confirmBlock = window.confirm(`🚫 BLOCK ${activeChat.name}?\n\nThey will not be able to message you.`);
    if(confirmBlock) {
      setMyProfile(prev => ({
        ...prev,
        blockedUsers: [...prev.blockedUsers, {id: activeChat.id, name: activeChat.name}]
      }));
      const updatedChats = chats.filter(c => c.id !== activeChatId);
      setChats(updatedChats);
      if (updatedChats.length > 0) setActiveChatId(updatedChats[0].id);
      alert(`${activeChat.name} has been blocked.`);
    }
  };

  const handleUnblock = (userId) => {
    setMyProfile(prev => ({
      ...prev,
      blockedUsers: prev.blockedUsers.filter(u => u.id !== userId)
    }));
    alert("User unblocked. (Re-add them to chat)");
  };

  const handleFileUpload = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMyProfile(prev => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    setMyProfile(prev => ({
        ...prev,
        name: formData.get('name'),
        email: formData.get('email'),
        status: formData.get('status'),
        birthDate: formData.get('birthDate')
    }));
    setShowProfile(false);
    alert("Profile Updated Successfully");
  };

  return (
    <div style={styles.appContainer}>

      {/* ================= MODAL ================= */}
      {showProfile && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
                <h2 style={{color:'#fff', margin:0, fontWeight:'900', letterSpacing:'2px', display:'flex', alignItems:'center', gap:'10px'}}>
                  <Settings size={24} color="#ffcc00"/> DIGITAL ID
                </h2>
                <button onClick={() => setShowProfile(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveProfile} style={styles.scrollableForm}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'30px'}}>
                    <div style={{position:'relative', filter:'drop-shadow(0 15px 30px rgba(0,0,0,0.4))'}}>
                        <img src={myProfile.avatar} alt="Avatar" style={{width:'120px', height:'120px', borderRadius:'50%', border:'3px solid rgba(255,255,255,0.9)', objectFit:'cover'}} />
                        <label htmlFor="avatar-upload" style={styles.uploadIconBtn}><Camera size={18} color="#000"/></label>
                    </div>
                    <input id="avatar-upload" type="file" accept="image/*" hidden onChange={(e) => handleFileUpload(e, 'avatar')} />
                </div>

                <div style={styles.sectionTitle}>AUDIO PROTOCOL</div>
                <div 
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between', 
                    padding:'12px 15px', background:'rgba(255,255,255,0.1)', 
                    borderRadius:'10px', cursor:'pointer', border:'1px solid rgba(255,255,255,0.2)', marginBottom:'20px'
                  }}
                >
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    {soundEnabled ? <Bell size={20} color="#00ff00"/> : <BellOff size={20} color="#ff3333"/>}
                    <span style={{fontSize:'14px', fontWeight:'600'}}>Sound Notifications</span>
                  </div>
                  <span style={{fontSize:'12px', color: soundEnabled ? '#00ff00' : '#ff3333'}}>{soundEnabled ? 'ON' : 'OFF'}</span>
                </div>

                <div style={styles.sectionTitle}>IDENTITY MATRIX</div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Display Name</label>
                    <input name="name" defaultValue={myProfile.name} style={styles.modalInput} />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Secure Email</label>
                    <input name="email" type="email" defaultValue={myProfile.email} style={styles.modalInput} />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Origin Date</label>
                    <input name="birthDate" type="date" defaultValue={myProfile.birthDate} style={styles.modalInput} />
                </div>

                <div style={styles.sectionTitle}>PRESENCE</div>
                <div style={styles.inputGroup}>
                    <select name="status" defaultValue={myProfile.status} style={styles.modalInput}>
                        <option value="Online">🟢 Online</option>
                        <option value="Busy">🔴 Busy</option>
                        <option value="Away">🟡 Away</option>
                    </select>
                </div>

                <div style={styles.sectionTitle}>INTERFACE</div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Background Source</label>
                    <div style={{display:'flex', alignItems:'center', gap:'15px', background:'rgba(255,255,255,0.1)', padding:'10px', borderRadius:'15px', border:'1px solid rgba(255,255,255,0.2)'}}>
                        <div style={{width:'60px', height:'40px', backgroundImage:`url(${myProfile.wallpaper})`, backgroundSize:'cover', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.5)'}}></div>
                        <label htmlFor="wp-upload" style={{...styles.glassButton, fontSize:'11px', padding:'8px 15px', display:'flex', alignItems:'center', gap:'8px'}}>
                          <ImageIcon size={14}/> UPLOAD 8K
                        </label>
                        <input id="wp-upload" type="file" accept="image/*" hidden onChange={(e) => handleFileUpload(e, 'wallpaper')} />
                    </div>
                </div>

                <div style={styles.sectionTitle}>BLACKLIST</div>
                <div style={styles.blockedList}>
                    {myProfile.blockedUsers.length === 0 && <div style={{fontSize:'12px', color:'#aaa'}}>No blocks active.</div>}
                    {myProfile.blockedUsers.map(user => (
                        <div key={user.id} style={styles.blockedItem}>
                            <span style={{color:'white'}}>🚫 {user.name}</span>
                            <button type="button" onClick={() => handleUnblock(user.id)} style={styles.unblockBtn}>Unblock</button>
                        </div>
                    ))}
                </div>

                <div style={{marginTop:'35px'}}>
                    <button type="submit" style={{...styles.yellowButtonStyle, width:'100%', padding:'16px', fontSize:'15px', letterSpacing:'1px'}}>SAVE CONFIGURATION</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SIDEBAR ================= */}
      <div style={{
        ...styles.sidebar,
        display: (isMobile && showChatOnMobile) ? 'none' : 'flex',
        width: isMobile ? '100%' : '340px'
      }}>

        <div style={styles.sidebarHeader}>
          <img 
            src={myProfile.avatar} 
            alt="Logo" 
            onClick={() => setShowProfile(true)}
            style={styles.logo3D} 
          />
          <div style={styles.brandTitle}>PrivexApp <span style={{fontSize:'10px', color:'#ffcc00', verticalAlign:'super'}}>8K</span></div>
        </div>

        <div style={styles.chatList}>
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => handleChatClick(chat.id)}
              style={{
                ...styles.chatItem,
                background: activeChatId === chat.id ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                borderLeft: activeChatId === chat.id ? '4px solid #ffcc00' : '4px solid transparent',
                boxShadow: activeChatId === chat.id ? '0 4px 30px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              <div style={styles.chatAvatar}>{chat.avatar}</div>
              <div style={styles.chatInfo}>
                <div style={styles.chatRowTop}>
                  <span style={styles.chatName}>{chat.name}</span>
                  <span style={styles.chatTime}>{chat.time}</span>
                </div>
                <div style={styles.chatRowBottom}>
                  <span style={styles.chatMsg}>{chat.lastMsg}</span>
                  {chat.unread > 0 && <span style={styles.unreadBadge}>{chat.unread}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= MAIN CHAT ================= */}
      <div style={{
        ...styles.mainChat,
        display: (isMobile && !showChatOnMobile) ? 'none' : 'flex',
        flex: 1
      }}>

        {/* HEADER */}
        <div style={styles.chatHeader}>
          <div style={styles.headerLeft}>
            {isMobile && (
              <button onClick={() => setShowChatOnMobile(false)} style={styles.backBtn}>⬅</button>
            )}
            <div style={styles.currentAvatar}>
              {activeChat?.avatar || '❓'}
            </div>
            <div style={styles.headerInfo}>
              <div style={styles.headerName}>
                {activeChat?.name || 'Select a Chat'}
              </div>
              <div style={styles.headerStatus}>
                 <span style={styles.onlineDot}></span>
                 Encrypted Link
              </div>
            </div>
          </div>

          <div style={styles.headerRight}>
            <button onClick={() => handleCall('Audio')} style={styles.yellowButtonStyle} title="Voice Call"><Phone size={18}/></button>
            <button onClick={() => handleCall('Video')} style={styles.yellowButtonStyle} title="Video Call"><Video size={18}/></button>
            <div style={styles.divider}></div>
            <button onClick={() => handleAttachment('photo')} style={styles.yellowButtonStyle} title="Photo"><Camera size={18}/></button>
            <button onClick={() => handleAttachment('doc')} style={styles.yellowButtonStyle} title="File"><Paperclip size={18}/></button>
            <div style={styles.divider}></div>
            <button onClick={handleDeleteFriend} style={{...styles.yellowButtonStyle, background:'linear-gradient(180deg, #ff3333 0%, #990000 100%)', borderColor:'#660000', color:'white'}} title="Delete"><Trash2 size={18}/></button>
            <button onClick={handleBlockUser} style={{...styles.yellowButtonStyle, background:'linear-gradient(180deg, #444 0%, #000 100%)', borderColor:'#222', color:'white'}} title="Block"><ShieldBan size={18}/></button>
            
            <div style={styles.divider}></div>
            <div onClick={() => setIsDecrypted(!isDecrypted)} style={{...styles.yellowButtonStyle, opacity: isDecrypted ? 1 : 0.8}} title="Encryption">
              {isDecrypted ? <Unlock size={18}/> : <Lock size={18}/>}
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        <div style={{
            ...styles.messagesArea,
            position:'relative',
            backgroundImage: `url(${myProfile.wallpaper})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        }}>
            <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', backgroundColor:'rgba(0,0,0,0.3)', zIndex:0}}></div>

            <div style={{position: 'relative', zIndex: 1, height: '100%', overflowY: 'auto'}}>
                {activeChat.conversation && activeChat.conversation.map((m, i) => {
                    const isMe = m.sender === 'Me';
                    const displayText = isDecrypted ? decryptMessage(m.text) : m.text;
                    
                    return (
                    <div key={i} style={{ ...styles.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                        ...styles.bubble,
                        background: isMe 
                            ? 'rgba(200, 255, 200, 0.95)' 
                            : 'rgba(255, 255, 255, 0.95)',
                        border: isMe ? 'none' : '1px solid rgba(255,255,255,0.4)',
                        color: '#000'
                        }}>
                        {!isMe && <div style={styles.senderLabel}>{m.sender}</div>}
                        <div style={{
                            fontSize: '15px',
                            fontFamily: isDecrypted ? '"Segoe UI", sans-serif' : '"Courier New", monospace',
                            fontWeight: '500',
                            lineHeight: '1.5',
                        }}>
                            {displayText}
                        </div>
                        <div style={styles.timestamp}>
                            {m.time}
                            {isMe && (
                                <span style={{marginLeft: '5px', verticalAlign:'middle'}}>
                                    {m.status === 'read' ? 
                                        <CheckCheck size={14} color="#007bff" /> : 
                                        <Check size={14} color="#888" />
                                    }
                                </span>
                            )}
                        </div>
                        </div>
                    </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
        </div>

        {/* INPUT BAR */}
        <div style={styles.inputBar}>
          <div style={styles.inputContainer}>
            <input
              style={styles.inputField}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={isDecrypted ? "Type a message..." : "Encrypting input..."}
              onKeyPress={e => e.key === 'Enter' ? handleSend() : null}
            />
          </div>
          {text.length > 0 ? (
            <button onClick={handleSend} style={{...styles.yellowButtonStyle, padding: '10px 15px'}}><Send size={20}/></button>
          ) : (
            <button onClick={handleVoiceMessage} style={{...styles.yellowButtonStyle, padding: '10px 15px'}}><Mic size={20}/></button>
          )}
        </div>

        {/* BOTTOM NAV */}
        <div style={styles.bottomNavBar}>
          <button onClick={() => setShowProfile(true)} style={styles.navButton}><User size={18}/> My Profile</button>
          <div style={styles.navDivider}></div>
          <button onClick={handleCreateGroup} style={styles.navButton}><Users size={18}/> New Group</button>
          <div style={styles.navDivider}></div>
          <button onClick={handleAddFriend} style={styles.navButton}><UserPlus size={18}/> Add Friend</button>
          <div style={styles.navDivider}></div>
          <button onClick={logout} style={{...styles.navButton, color:'#ff3333'}}><LogOut size={18}/> Log Out</button>
        </div>

        {/* COPYRIGHT FOOTER (Added Here) */}
        <div style={styles.copyrightFooter}>
          2026 GMYCO TECHNOLOGIES ES - 0863875 | office@gmyco.es | PrivexApp Policies
        </div>

      </div>
    </div>
  );
}

// === 8K UHD STYLES ===
const styles = {
  appContainer: { 
    display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', 
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
    backgroundColor:'#121212',
    color: 'white',
    WebkitFontSmoothing: 'antialiased',
    textRendering: 'optimizeLegibility'
  },

  yellowButtonStyle: {
    background: 'linear-gradient(145deg, #fff700, #ffcc00)',
    borderRadius: '30px', 
    border: '1px solid rgba(255,255,255,0.6)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#443300', 
    fontSize: '15px', fontWeight: '800',
    padding: '8px 14px', 
    boxShadow: '0 5px 15px rgba(255, 204, 0, 0.25), inset 0 2px 2px rgba(255,255,255,0.9)', 
    transition: 'all 0.1s ease', 
    outline: 'none', margin: '0 4px',
    textShadow: '0 1px 0 rgba(255,255,255,0.6)'
  },
  
  glassButton: {
    background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius:'20px',
    cursor:'pointer', color:'#fff', fontWeight:'700',
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition:'0.2s'
  },

  modalOverlay: { 
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(15px)', 
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' 
  },
  modalContent: { 
    background: 'rgba(30, 30, 30, 0.75)', backdropFilter: 'blur(40px)',
    borderRadius: '30px', width: '420px', maxHeight:'85vh', 
    boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)', 
    border: '1px solid rgba(255,255,255,0.1)',
    overflow:'hidden', display:'flex', flexDirection:'column',
    color:'white'
  },
  modalHeader: { padding:'25px 30px', borderBottom:'1px solid rgba(255,255,255,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center' },
  closeBtn: { background:'rgba(255,255,255,0.1)', borderRadius:'50%', width:'32px', height:'32px', border:'none', fontSize:'16px', cursor:'pointer', color:'white', transition:'0.2s', display:'flex', alignItems:'center', justifyContent:'center' },
  scrollableForm: { padding:'30px', overflowY:'auto' },
  sectionTitle: { fontSize:'11px', fontWeight:'900', color:'#ffcc00', marginTop:'25px', marginBottom:'12px', letterSpacing:'2px', textTransform:'uppercase' },
  inputGroup: { marginBottom:'20px' },
  label: { display: 'block', textAlign: 'left', fontWeight: '600', marginBottom: '8px', fontSize:'13px', color:'#ccc' },
  modalInput: { 
    width: '100%', padding: '14px 18px', borderRadius: '15px', 
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', 
    fontSize:'15px', outline:'none', boxSizing:'border-box', color:'white',
    boxShadow:'inset 0 2px 5px rgba(0,0,0,0.2)'
  },
  uploadIconBtn: { position:'absolute', bottom:'0', right:'0', background:'#ffcc00', width:'36px', height:'36px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'3px solid #222', fontSize:'18px', boxShadow:'0 4px 10px rgba(0,0,0,0.4)' },
  blockedList: { background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'15px', padding:'15px', maxHeight:'120px', overflowY:'auto' },
  blockedItem: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'14px', padding:'10px', borderBottom:'1px solid rgba(255,255,255,0.05)' },
  unblockBtn: { background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'white', padding:'5px 12px', borderRadius:'15px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' },

  sidebar: { 
    borderRight: '1px solid rgba(255,255,255,0.1)', 
    flexDirection: 'column', 
    background: 'rgba(20, 20, 20, 0.85)', 
    backdropFilter: 'blur(30px)', 
    zIndex: 2, 
    boxShadow: '10px 0 30px rgba(0,0,0,0.2)'
  },
  sidebarHeader: { 
    height: '100px', 
    background: 'rgba(255,255,255,0.02)', 
    display: 'flex', alignItems: 'center', gap:'18px', padding: '0 30px', 
    borderBottom: '1px solid rgba(255,255,255,0.05)' 
  },
  logo3D: { 
    width: '60px', height: '60px', borderRadius: '50%', objectFit: 'contain', 
    backgroundColor: 'white', padding: '3px', cursor:'pointer', 
    border: '2px solid #ffcc00', boxShadow: '0 0 20px rgba(255, 204, 0, 0.3)' 
  },
  brandTitle: { fontSize:'24px', color:'white', fontWeight:'800', letterSpacing:'1px', textShadow:'0 2px 10px rgba(0,0,0,0.5)' },

  chatList: { flex: 1, overflowY: 'auto', padding:'15px 0' },
  chatItem: { display: 'flex', alignItems: 'center', padding: '18px 25px', cursor: 'pointer', margin:'4px 15px', borderRadius:'16px', transition: 'all 0.2s' },
  chatAvatar: { width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #e0e0e0, #fff)', boxShadow:'0 5px 15px rgba(0,0,0,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', marginRight:'18px', flexShrink: 0 },
  chatInfo: { flex: 1, minWidth: 0 },
  chatRowTop: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  chatName: { fontWeight: '700', fontSize: '16px', color: '#eee', textShadow:'0 1px 2px rgba(0,0,0,0.5)' },
  chatTime: { fontSize: '12px', color: '#888', fontWeight:'500' },
  chatRowBottom: { display: 'flex', justifyContent: 'space-between' },
  chatMsg: { fontSize: '14px', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' },
  unreadBadge: { background: '#00ff88', boxShadow:'0 0 10px rgba(0,255,136,0.6)', color: '#004400', fontSize: '11px', padding: '5px 9px', borderRadius: '12px', fontWeight: '900' },

  mainChat: { flexDirection: 'column', position: 'relative', background:'#000' },
  
  chatHeader: { 
    height: '100px', 
    background: 'rgba(18, 18, 18, 0.9)', 
    backdropFilter: 'blur(20px)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', color: 'white', 
    boxShadow: '0 5px 30px rgba(0,0,0,0.5)', zIndex: 10, borderBottom:'1px solid rgba(255,255,255,0.05)'
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '20px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  divider: { width: '1px', height: '35px', background: 'rgba(255,255,255,0.1)', margin: '0 10px' },
  
  backBtn: { background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', paddingRight: '10px' },
  currentAvatar: { width: '46px', height: '46px', borderRadius: '50%', background: 'white', border:'2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow:'0 0 15px rgba(255,255,255,0.1)' },
  headerInfo: { display: 'flex', flexDirection: 'column' },
  headerName: { fontWeight: '800', fontSize: '20px', letterSpacing:'0.5px', textShadow:'0 2px 10px rgba(0,0,0,0.5)' },
  headerStatus: { fontSize: '13px', opacity: 0.7, fontWeight:'400', display:'flex', alignItems:'center', letterSpacing:'1px' },
  onlineDot: { display:'inline-block', width:'8px', height:'8px', background:'#00ff88', borderRadius:'50%', marginRight:'8px', boxShadow:'0 0 8px #00ff88' },

  messagesArea: { flex: 1, padding: '30px', overflowY: 'auto' },
  
  msgRow: { display: 'flex', marginBottom: '20px' },
  bubble: { maxWidth: '75%', padding: '15px 22px', display: 'flex', flexDirection: 'column', borderRadius:'20px', backdropFilter:'blur(10px)', boxShadow:'0 5px 20px rgba(0,0,0,0.1)' },
  senderLabel: { color: '#0055ff', fontSize: '12px', fontWeight: '800', marginBottom: '5px', textTransform:'uppercase' },
  timestamp: { alignSelf: 'flex-end', fontSize: '11px', color: 'rgba(0,0,0,0.5)', marginTop: '8px', fontWeight:'600' },

  inputBar: { 
    background: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(20px)',
    padding: '20px 30px', display: 'flex', alignItems: 'center', gap: '20px', 
    borderTop:'1px solid rgba(255,255,255,0.05)', boxShadow:'0 -10px 40px rgba(0,0,0,0.3)' 
  },
  inputContainer: { 
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '30px', padding: '15px 25px', 
    display: 'flex', alignItems: 'center', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.05)'
  },
  inputField: { width: '100%', border: 'none', outline: 'none', fontSize: '16px', background:'transparent', color:'white', fontWeight:'500' },

  bottomNavBar: {
    height: '75px',
    background: 'linear-gradient(180deg, #222, #111)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    padding: '0 15px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
  },
  navButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '700',
    color: '#bbb',
    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: '0.2s'
  },
  navDivider: {
    width: '1px',
    height: '35px',
    background: '#333',
    boxShadow: '1px 0 0 rgba(255,255,255,0.05)'
  },
  
  // --- COPYRIGHT FOOTER STYLE ---
  copyrightFooter: {
    height: '25px', 
    background: '#0a0a0a', // Matte Black
    color: '#555',
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    fontFamily: '"Segoe UI", sans-serif',
    letterSpacing: '0.5px'
  }
};