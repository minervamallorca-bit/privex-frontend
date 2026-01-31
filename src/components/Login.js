import React, { useState, useEffect } from 'react';
import logo from '../logo.png';
import { Lock, UserPlus, ArrowRight, AlertTriangle } from 'lucide-react';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('loading'); // 'loading', 'register', 'login'
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState(null);
  const [error, setError] = useState('');

  // 1. Check if this device is already registered
  useEffect(() => {
    const savedData = localStorage.getItem('privex_credentials');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setStoredPin(parsed.pin);
      setName(parsed.name);
      setMode('login'); // Ask for PIN
    } else {
      setMode('register'); // Ask for Details
    }
  }, []);

  // 2. Handle Registration (First Time)
  const handleRegister = () => {
    if (!name.trim() || pin.length !== 6) {
      setError('NAME REQUIRED & PIN MUST BE 6 DIGITS');
      return;
    }
    
    const credentials = { name, pin };
    // Save credentials PERMANENTLY to device
    localStorage.setItem('privex_credentials', JSON.stringify(credentials));
    
    // Log them in
    onLogin(credentials);
  };

  // 3. Handle Login (Returning User)
  const handleLoginAttempt = () => {
    if (pin === storedPin) {
      const credentials = { name, pin };
      onLogin(credentials);
    } else {
      setError('ACCESS DENIED: INVALID PIN');
      setPin(''); // Clear input
    }
  };

  // 4. Handle "Delete Identity" (Reset)
  const handleReset = () => {
    if(window.confirm("WARNING: This will wipe your identity from this device. Continue?")) {
        localStorage.removeItem('privex_credentials');
        setMode('register');
        setName('');
        setPin('');
        setError('');
    }
  };

  // --- RENDER ---
  if (mode === 'loading') return null;

  return (
    <div style={styles.container}>
      <img src={logo} alt="Logo" style={styles.logo} />
      
      <div style={styles.card}>
        <div style={styles.header}>
            {mode === 'register' ? <UserPlus size={24} color="#00ff00"/> : <Lock size={24} color="#ffcc00"/>}
            <h2 style={{margin:0, color: mode === 'register' ? '#00ff00' : '#ffcc00'}}>
                {mode === 'register' ? 'NEW IDENTITY' : 'SECURITY CHECK'}
            </h2>
        </div>

        {error && <div style={styles.error}><AlertTriangle size={16}/> {error}</div>}

        {mode === 'register' && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>CODENAME</label>
            <input 
              style={styles.input} 
              placeholder="Enter Callsign" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label}>
             {mode === 'register' ? 'CREATE 6-DIGIT PIN' : `WELCOME BACK, ${name.toUpperCase()}`}
          </label>
          <input 
            style={{...styles.input, textAlign: 'center', letterSpacing: '8px', fontSize: '24px'}} 
            type="password"
            maxLength="6"
            placeholder="••••••" 
            value={pin} 
            onChange={(e) => {
                // Only allow numbers
                if (/^\d*$/.test(e.target.value)) setPin(e.target.value);
                setError('');
            }}
          />
        </div>

        <button 
            onClick={mode === 'register' ? handleRegister : handleLoginAttempt} 
            style={mode === 'register' ? styles.regBtn : styles.loginBtn}
        >
            {mode === 'register' ? 'INITIALIZE SYSTEM' : 'UNLOCK TERMINAL'} <ArrowRight size={20}/>
        </button>

        {mode === 'login' && (
            <button onClick={handleReset} style={styles.resetLink}>
                Reset Device Identity
            </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#fff', fontFamily: 'monospace' },
  logo: { width: '80px', marginBottom: '30px' },
  card: { background: '#121212', padding: '40px', borderRadius: '20px', border: '1px solid #333', width: '320px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
  header: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px', justifyContent: 'center' },
  inputGroup: { marginBottom: '20px' },
  label: { display: 'block', color: '#666', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase' },
  input: { width: '100%', padding: '15px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px', fontSize: '16px', outline: 'none' },
  regBtn: { width: '100%', padding: '15px', background: '#00ff00', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  loginBtn: { width: '100%', padding: '15px', background: '#ffcc00', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  error: { color: '#ff3333', fontSize: '12px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,50,50,0.1)', padding: '10px', borderRadius: '5px' },
  resetLink: { background: 'none', border: 'none', color: '#444', fontSize: '11px', marginTop: '20px', width: '100%', cursor: 'pointer', textDecoration: 'underline' }
};