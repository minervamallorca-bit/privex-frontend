import React, { useState } from 'react';
import logo from '../logo.png'; // Make sure this path is correct for your folder

export default function Login({ onLogin }) {
  const [name, setName] = useState('');

  const handleEnter = () => {
    if (!name.trim()) return;
    
    const userData = {
      name: name,
      id: Date.now(), // Give them a unique ID
      loginTime: new Date().toLocaleTimeString()
    };

    onLogin(userData);
  };

  return (
    <div style={styles.container}>
      <img src={logo} alt="Privex Logo" style={styles.logo} />
      <h2 style={styles.title}>IDENTITY REQUIRED</h2>
      
      <input
        style={styles.input}
        placeholder="Enter Callsign..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleEnter()}
      />
      
      <button onClick={handleEnter} style={styles.button}>
        ACCESS TERMINAL
      </button>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#121212', color: '#00ff00', fontFamily: 'monospace' },
  logo: { width: '100px', marginBottom: '20px' },
  title: { letterSpacing: '2px', marginBottom: '30px' },
  input: { padding: '15px', borderRadius: '5px', border: '1px solid #333', background: '#000', color: '#fff', fontSize: '16px', outline: 'none', textAlign: 'center', width: '250px' },
  button: { marginTop: '20px', padding: '12px 30px', background: '#00ff00', color: '#000', border: 'none', fontWeight: 'bold', cursor: 'pointer', borderRadius: '5px' }
};