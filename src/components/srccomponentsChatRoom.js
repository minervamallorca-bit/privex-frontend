import React, { useState } from 'react';
import { useChat } from '../hooks/useChat';

export default function ChatRoom({ user, logout }) {
  const { messages, sendMessage } = useChat('global-room');
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3>PRIVEX Secure Chat</h3>
        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
      </div>

      {/* Messages Area */}
      <div style={styles.chatBox}>
        {messages.map((m, i) => {
          const isMe = m.senderEmail === 'Me';
          return (
            <div key={i} style={{...styles.messageRow, justifyContent: isMe ? 'flex-end' : 'flex-start'}}>
              <div style={{
                ...styles.bubble, 
                backgroundColor: isMe ? '#007bff' : '#e9ecef',
                color: isMe ? 'white' : 'black'
              }}>
                <small style={{fontSize:'10px', opacity:0.7}}>{m.senderEmail}</small>
                <div>{m.content}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div style={styles.inputArea}>
        <input 
          style={styles.input}
          value={text} 
          onChange={e => setText(e.target.value)} 
          placeholder="Type a message..."
          onKeyPress={e => e.key === 'Enter' ? handleSend() : null}
        />
        <button onClick={handleSend} style={styles.sendBtn}>Send</button>
      </div>
    </div>
  );
}

// Simple CSS Styles inside the file
const styles = {
  container: { maxWidth: '600px', margin: '20px auto', border: '1px solid #ddd', borderRadius: '10px', overflow: 'hidden', fontFamily: 'Arial, sans-serif' },
  header: { background: '#f8f9fa', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd' },
  logoutBtn: { background: '#ff4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' },
  chatBox: { height: '400px', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  messageRow: { display: 'flex', width: '100%' },
  bubble: { padding: '10px 15px', borderRadius: '15px', maxWidth: '70%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
  inputArea: { padding: '15px', borderTop: '1px solid #ddd', display: 'flex', gap: '10px', background: '#fff' },
  input: { flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ccc', outline: 'none' },
  sendBtn: { padding: '10px 20px', borderRadius: '20px', border: 'none', background: '#28a745', color: 'white', cursor: 'pointer', fontWeight: 'bold' }
};