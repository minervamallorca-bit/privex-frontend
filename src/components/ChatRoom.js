import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; // Connect to the file you just made
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

export default function ChatRoom({ user, logout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // 1. LISTEN TO DATABASE (Real-Time Connection)
  useEffect(() => {
    // Create a query to ask for messages sorted by time
    const q = query(collection(db, "messages"), orderBy("createdAt"));

    // Open a live channel (websocket) to Google
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(liveMessages);
    });

    // Close channel when leaving
    return () => unsubscribe();
  }, []);

  // 2. AUTO-SCROLL TO BOTTOM
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. SEND MESSAGE TO CLOUD
  const handleSend = async () => {
    if (!input.trim()) return;

    // Send data to Firestore
    await addDoc(collection(db, "messages"), {
      text: input,
      sender: user.name,
      createdAt: serverTimestamp(), // Let server decide the time
      isSystem: false
    });

    setInput(''); // Clear input
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
            <span>UPLINK_ESTABLISHED: {messages.length} MSGS</span>
        </div>
        <button onClick={logout} style={styles.logoutBtn}>
            DISCONNECT 🚫
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
            📤 SEND
        </button>
      </div>
    </div>
  );
}

// MATRIX STYLES (Unchanged)
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
    padding: '5px 10px', fontSize: '10px', cursor: 'pointer', fontFamily: 'monospace'
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