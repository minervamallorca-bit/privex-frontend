
import React, { useState } from 'react';
import ChatRoom from './components/ChatRoom';
import logo from './logo.png'; 

function App() {
  const [user, setUser] = useState(null);

  // LOGIN LOGIC
  const handleLogin = (e) => {
    e.preventDefault();
    const phone = e.target.phone.value;
    const name = e.target.username.value;

    if (phone.length < 3 || name.length < 2) {
      alert("Please enter a valid Phone Number and Name.");
      return;
    }

    setUser({
      phone: phone,
      displayName: name,
      id: Date.now()
    });
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (user) {
    return <ChatRoom user={user} logout={handleLogout} />;
  }

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginBox}>
        
        <div style={styles.logoWrapper}>
          <img src={logo} alt="Privex Logo" style={styles.logo3D} />
        </div>
        
        <h1 style={styles.title}>PRIVEX<span style={{color:'#ffcc00'}}>APP</span></h1>
        <p style={styles.subtitle}>8K SECURE LINK</p>

        <form onSubmit={handleLogin} style={styles.form}>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>MOBILE NUMBER</label>
            <input 
              name="phone" 
              type="tel" 
              placeholder="+1 (555) 000-0000" 
              style={styles.input} 
              autoComplete="off"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>DISPLAY NAME</label>
            <input 
              name="username" 
              type="text" 
              placeholder="Enter your name" 
              style={styles.input} 
              autoComplete="off"
            />
          </div>

          <button type="submit" style={styles.loginBtn}>
            ESTABLISH CONNECTION ➤
          </button>

        </form>

        <div style={styles.footer}>
          Encrypted • Anonymous • Secure
        </div>
      </div>
    </div>
  );
}

// === 8K LOGIN STYLES ===
const styles = {
  loginContainer: {
    height: '100vh', width: '100vw', backgroundColor: '#121212', color:'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  loginBox: {
    width: '90%', maxWidth: '400px', background: 'rgba(30, 30, 30, 0.8)',
    backdropFilter: 'blur(20px)', borderRadius: '30px', padding: '40px 30px',
    border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
    textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxSizing: 'border-box'
  },
  logoWrapper: { marginBottom: '20px' },
  logo3D: {
    width: '90px', height: '90px', borderRadius: '50%', objectFit: 'contain',
    backgroundColor: 'white', padding: '5px', border: '4px solid #ffcc00',
    boxShadow: '0 0 20px rgba(255, 204, 0, 0.4)'
  },
  title: { fontSize: '32px', fontWeight: '900', margin: '0', letterSpacing: '2px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' },
  subtitle: { fontSize: '12px', color: '#888', letterSpacing: '4px', marginBottom: '30px', fontWeight: '600', marginTop:'5px' },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing:'border-box' },
  inputGroup: { textAlign: 'left', width: '100%', boxSizing:'border-box' },
  label: { display: 'block', fontSize: '11px', color: '#ffcc00', fontWeight: '800', marginBottom: '8px', paddingLeft: '10px' },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '16px 20px', borderRadius: '15px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0, 0, 0, 0.4)',
    color: 'white', fontSize: '16px', outline: 'none', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)'
  },
  loginBtn: {
    marginTop: '10px', width: '100%', boxSizing: 'border-box',
    background: 'linear-gradient(145deg, #fff700, #ffcc00)', borderRadius: '30px',
    border: 'none', cursor: 'pointer', color: '#443300', fontFamily: 'Arial',
    fontSize: '16px', fontWeight: '900', padding: '16px',
    boxShadow: '0 5px 15px rgba(255, 204, 0, 0.3)', textTransform: 'uppercase', letterSpacing: '1px'
  },
  footer: { marginTop: '30px', fontSize: '11px', color: '#555' }
};

export default App;