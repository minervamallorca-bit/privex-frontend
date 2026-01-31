import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

// REAL BASE64 TACTICAL BEEP (No internet download needed)
const TACTICAL_BEEP = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIQAABQoPEBwdIiYqLS8xMzU4Ojw+QENFRkdKS01QUlVYWlxeYWJkZmhqbG9wcXR3ent9foCDhIWIi4yOkJKUl5ianJ6goqOkpqeoqqyusLKztLe6u72/wcPExsfIysvMzs/Q0tPU1dbX2Nna29ze3+Dj5Ofp6uvs7e7v8PHy9Pf4+fr7/P0AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAASAAAAG7AAAAAAAA//OEBgAAAAABIAAAACABH4T/P/7U+X7X84eD5/X/t/b/7/n/9///x/w/+j+m+h9f//+v/7////////4AAABuAAAAACAAAP/zhAYAAAAAASAAAAAgAR+E/z/+1Pl+1/OHg+f1/7f2/+/5//f//8f8P/o/pvofX///r/+/AAAAAG4AAAAAIAAA//OEBgAAAAABIAAAACABH4T/P/7U+X7X84eD5/X/t/b/7/n/9///x/w/+j+m+h9f//+v/78AAAAAbgAAAAAgAAD/84QGAAAAAAEgAAAAIAEfhP8//tT5ftfzh4Pn9f+39v/v+f/3///H/D/6P6b6H1///6//vwAAAABuAAAAACAAAP/zhAYAAAAAASAAAAAgAR+E/z/+1Pl+1/OHg+f1/7f2/+/5//f//8f8P/o/pvofX///r/+/AAAAAG4AAAAAIAAA//OEBgAAAAABIAAAACABH4T/P/7U+X7X84eD5/X/t/b/7/n/9///x/w/+j+m+h9f//+v/78AAAAAbgAAAAAgAAD/84QGAAAAAAEgAAAAIAEfhP8//tT5ftfzh4Pn9f+39v/v+f/3///H/D/6P6b6H1///6//vwAAAABuAAAAACAAAP/zhAYAAAAAASAAAAAgAR+E/z/+1Pl+1/OHg+f1/7f2/+/5//f//8f8P/o/pvofX///r/+/AAAAAG4AAAAAIAAA//OEBgAAAAABIAAAACABH4T/P/7U+X7X84eD5/X/t/b/7/n/9///x/w/+j+m+h9f//+v/78AAAAAbgAAAAAgAAD/84QGAAAAAAEgAAAAIAEfhP8//tT5ftfzh4Pn9f+39v/v+f/3///H/D/6P6b6H1///6//vwAAAABuAAAAACAAAP/zhAYAAAAAASAAAAAgAR+E/z/+1Pl+1/OHg+f1/7f2/+/5//f//8f8P/o/pvofX///r/+/AAAAAG4AAAAAIAAA//OEBgAAAAABIAAAACABH4T/P/7U+X7X84eD5/X/t/b/7/n/9///x/w/+j+m+h9f//+v/78AAAAAbgAAAAAgAAD/84QGAAAAAAEgAAAAIAEfhP8//tT5ftfzh4Pn9f+39v/v+f/3///H/D/6P6b6H1///6//vwAAAABuAAAAACAAAP/zhAYAAAAAASAAAAAgAR+E/z/+1Pl+1/OHg+f1/7f2/+/5//f//8f8P/o/pvofX///r/+/AAAAAG4AAAAAIAAA";

export default function ChatRoom({ user, logout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Audio Player
  const audioRef = useRef(new Audio(TACTICAL_BEEP)); 

  // 1. LISTEN TO DATABASE
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Play sound ONLY if it's a new message and NOT from me
      if (liveMessages.length > 0 && messages.length > 0) {
        const lastMsg = liveMessages[liveMessages.length - 1];
        if (lastMsg.sender !== user.name && liveMessages.length > messages.length) {
            playSound();
        }
      }

      setMessages(liveMessages);
    });

    return () => unsubscribe();
  }, [messages.length, user.name]); 

  // Helper: Play Sound safely
  const playSound = () => {
    // Reset sound to start and play
    audioRef.current.currentTime = 0;
    audioRef.current.play()
      .then(() => setSoundEnabled(true)) // If success, mark as enabled
      .catch(e => console.log("Sound blocked until interaction"));
  };

  // 2. AUTO-SCROLL
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. SEND MESSAGE
  const handleSend = async () => {
    if (!input.trim()) return;
    await addDoc(collection(db, "messages"), {
      text: input,
      sender: user.name,
      createdAt: serverTimestamp(),
      isSystem: false
    });
    setInput(''); 
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.status}>
            <span style={styles.dot}></span>
            <span>UPLINK_ACTIVE</span>
        </div>
        
        {/* SOUND CHECK BUTTON */}
        <button onClick={playSound} style={styles.soundBtn}>
           {soundEnabled ? '🔊 ON' : '🔇 TEST AUDIO'}
        </button>

        <button onClick={logout} style={styles.logoutBtn}>
            EXIT
        </button>
      </div>

      {/* CHAT AREA */}
      <div style={styles.chatWindow}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            style={{
              ...styles.messageRow,
              justifyContent: msg.isSystem ? 'center' : (msg.sender === user.name ? 'flex-end' : 'flex-start')
            }}
          >
            <div style={
              msg.isSystem ? styles.systemBubble : 
              (msg.sender === user.name ? styles.myBubble : styles.otherBubble)
            }>
              {!msg.isSystem && <div style={styles.senderName}>{msg.sender.toUpperCase()}</div>}
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div style={styles.inputArea}>
        <input 
          style={styles.input} 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="TRANSMIT DATA..."
        />
        <button onClick={handleSend} style={styles.sendBtn}>
            📤
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#050505', color: '#00ff00', fontFamily: 'monospace'
  },
  header: {
    padding: '15px', borderBottom: '1px solid #333', background: '#0a0a0a',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 0 10px rgba(0, 255, 0, 0.1)'
  },
  status: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', letterSpacing: '2px' },
  dot: { width: '8px', height: '8px', background: '#00ff00', borderRadius: '50%', boxShadow: '0 0 5px #00ff00' },
  logoutBtn: {
    background: 'transparent', border: '1px solid #ff3333', color: '#ff3333',
    padding: '5px 10px', fontSize: '10px', cursor: 'pointer', fontFamily: 'monospace', marginLeft: '10px'
  },
  soundBtn: {
    background: '#222', border: '1px solid #00ff00', color: '#00ff00',
    padding: '5px 10px', fontSize: '10px', cursor: 'pointer', fontFamily: 'monospace', borderRadius: '4px'
  },
  chatWindow: {
    flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px'
  },
  messageRow: { display: 'flex', width: '100%' },
  systemBubble: {
    fontSize: '10px', color: '#666', border: '1px solid #333', 
    padding: '5px 10px', borderRadius: '4px', background: '#000'
  },
  myBubble: {
    background: 'rgba(0, 255, 0, 0.1)', border: '1px solid #00ff00', 
    color: '#fff', padding: '10px 15px', borderRadius: '15px 15px 0 15px',
    maxWidth: '80%', boxShadow: '0 0 5px rgba(0,255,0,0.2)'
  },
  otherBubble: {
    background: '#222', border: '1px solid #444', 
    color: '#ddd', padding: '10px 15px', borderRadius: '15px 15px 15px 0',
    maxWidth: '80%'
  },
  senderName: { fontSize: '9px', color: '#00ff00', marginBottom: '4px', opacity: 0.7 },
  inputArea: {
    padding: '15px', background: '#0a0a0a', borderTop: '1px solid #333',
    display: 'flex', gap: '10px'
  },
  input: {
    flex: 1, padding: '15px', background: '#000', border: '1px solid #333',
    color: '#fff', fontFamily: 'monospace', outline: 'none', borderRadius: '5px'
  },
  sendBtn: {
    background: '#00ff00', color: '#000', border: 'none', padding: '0 20px',
    fontWeight: 'bold', cursor: 'pointer', borderRadius: '5px', fontFamily: 'monospace'
  }
};