import React, { useState } from 'react';

export default function Login({ onLogin, theme }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onLogin({ name: name, id: Date.now() });
    }
  };

  return (
    <div style={{...styles.container, background: theme.bg, color: theme.primary}}>
      <div style={{...styles.box, borderColor: theme.primary, boxShadow: `0 0 15px ${theme.secondary}`}}>
        <h1 style={styles.title}>PRIVEX V4.0 (SECURE)</h1>
        
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="ENTER AGENT ID" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{...styles.input, borderColor: theme.primary, color: theme.primary}}
          />
          <button type="submit" style={{...styles.button, background: theme.primary}}>
            AUTHENTICATE
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'monospace' },
  box: { padding: '40px', border: '1px solid', borderRadius: '10px', textAlign: 'center', background: 'rgba(0,0,0,0.5)' },
  title: { fontSize: '24px', marginBottom: '30px', letterSpacing: '2px' },
  input: { width: '100%', padding: '15px', background: 'transparent', border: '1px solid', marginBottom: '20px', textAlign: 'center', fontSize: '16px', outline: 'none' },
  button: { width: '100%', padding: '15px', border: 'none', color: '#000', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }
};