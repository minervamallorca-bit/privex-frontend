import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

// --- DECRYPTION ENGINE (SLOWED DOWN FOR VISIBILITY) ---
const DecryptedText = ({ text }) => {
  const [display, setDisplay] = useState('');
  const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(
        text
          .split('')
          .map((letter, index) => {
            // Logic: Only reveal the letter if the iteration has passed it
            if (index < iteration) return text[index];
            // Otherwise show a random Matrix character
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );

      if (iteration >= text.length) clearInterval(interval);
      
      // SLOWER SPEED: 1/3 means it takes 3 frames to solve ONE letter
      iteration += 1 / 3; 
    }, 60); // SLOWER FRAME RATE: Updates every 60ms

    return () => clearInterval(interval);
  }, [text]);

  return <span>{display}</span>;
};

export default function ChatRoom({ user, logout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (liveMessages.length > 0 && messages.length > 0) {
        const lastMsg = liveMessages[liveMessages.length - 1];
        if (lastMsg.sender !== user.name && liveMessages.length > messages.length) {
            playDigitalBeep();
        }
      }
      setMessages(liveMessages);
    });
    return () => unsubscribe();
  }, [messages.length, user.name]); 

  // SYNTHESIZER SOUND
  const playDigitalBeep = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(1000, ctx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15); 
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      <div style={styles.header}>
        <div style={styles.status}>
            <span style={styles.dot}></span>
            <span>UPLINK_SECURE</span>
        </div>
        <button onClick={playDigitalBeep} style={styles.soundBtn}>🔊 TEST</button>
        <button onClick={logout} style={styles.logoutBtn}>EXIT</button>
      </div>

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
              {/* THE DECRYPTION EFFECT IS HERE */}
              <DecryptedText text={msg.text} />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <input 
          style={styles.input} 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="TRANSMIT DATA..."
        />
        <button onClick={handleSend} style={styles.sendBtn}>📤</button>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#050505', color: '#00ff00', fontFamily: 'monospace' },
  header: { padding: '15px', borderBottom: '1px solid #333', background: '#0a0a0a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 0 10px rgba(0, 255, 0, 0.1)' },
  status: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', letterSpacing: '2px' },
  dot: { width: '8px', height: '8px', background: '#00ff00', borderRadius: '50%', boxShadow: '0 0 5px #00ff00' },
  logoutBtn: { background: 'transparent', border: '1px solid #ff3333', color: '#ff3333', padding: '5px 10px', fontSize: '10px', cursor: 'pointer', fontFamily: 'monospace', marginLeft: '10px' },
  soundBtn: { background: '#222', border: '1px solid #00ff00', color: '#00ff00', padding: '5px 10px', fontSize: '10px', cursor: 'pointer', fontFamily: 'monospace', borderRadius: '4px' },
  chatWindow: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
  messageRow: { display: 'flex', width: '100%' },
  systemBubble: { fontSize: '10px', color: '#666', border: '1px solid #333', padding: '5px 10px', borderRadius: '4px', background: '#000' },
  myBubble: { background: 'rgba(0, 255, 0, 0.1)', border: '1px solid #00ff00', color: '#fff', padding: '10px 15px', borderRadius: '15px 15px 0 15px', maxWidth: '80%', boxShadow: '0 0 5px rgba(0,255,0,0.2)' },
  otherBubble: { background: '#222', border: '1px solid #444', color: '#ddd', padding: '10px 15px', borderRadius: '15px 15px 15px 0', maxWidth: '80%' },
  senderName: { fontSize: '9px', color: '#00ff00', marginBottom: '4px', opacity: 0.7 },
  inputArea: { padding: '15px', background: '#0a0a0a', borderTop: '1px solid #333', display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '15px', background: '#000', border: '1px solid #333', color: '#fff', fontFamily: 'monospace', outline: 'none', borderRadius: '5px' },
  sendBtn: { background: '#00ff00', color: '#000', border: 'none', padding: '0 20px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '5px', fontFamily: 'monospace' }
};