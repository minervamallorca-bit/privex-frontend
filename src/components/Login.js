import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onLogin({ name: name, id: Date.now() });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h1>PRIVEX V3.1 (RESTORED)</h1>
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="ENTER AGENT ID" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>INITIALIZE</button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000', color: '#00ff00', fontFamily: 'monospace' },
  box: { padding: '40px', border: '1px solid #00ff00', borderRadius: '10px', textAlign: 'center' },
  title: { fontSize: '24px', marginBottom: '30px', letterSpacing: '2px' },
  input: { width: '100%', padding: '15px', background: 'transparent', border: '1px solid #00ff00', color: '#00ff00', marginBottom: '20px', textAlign: 'center', fontSize: '16px', outline: 'none' },
  button: { width: '100%', padding: '15px', background: '#00ff00', border: 'none', color: '#000', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }
};