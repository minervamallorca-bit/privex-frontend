import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ChatRoom from './components/ChatRoom';
import './App.css';

// 🎨 THEMES CONFIGURATION
const THEMES = {
  green: { primary: '#00ff00', bg: '#050505', secondary: 'rgba(0, 255, 0, 0.1)' },
  red:   { primary: '#ff0055', bg: '#1a0505', secondary: 'rgba(255, 0, 85, 0.1)' },
  blue:  { primary: '#00ffff', bg: '#001a1a', secondary: 'rgba(0, 255, 255, 0.1)' },
  grey:  { primary: '#aaaaaa', bg: '#111111', secondary: 'rgba(255, 255, 255, 0.1)' }
};

// 🔒 PIN COMPONENT
function PinPad({ onUnlock, theme }) {
  const [pin, setPin] = useState('');
  const CORRECT_PIN = "1999"; // <--- YOUR MASTER PASSWORD

  const handlePress = (num) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin === CORRECT_PIN) onUnlock();
      if (newPin.length === 4 && newPin !== CORRECT_PIN) {
        setTimeout(() => setPin(''), 300); // Shake/Reset on fail
      }
    }
  };

  return (
    <div style={{...styles.container, color: theme.primary, background: theme.bg}}>
      <div style={{border: `1px solid ${theme.primary}`, padding: '40px', borderRadius: '10px', textAlign: 'center'}}>
        <h2 style={{letterSpacing: '3px'}}>SECURITY CLEARANCE</h2>
        <div style={{fontSize: '40px', margin: '20px', letterSpacing: '10px'}}>
          {pin.padEnd(4, '•').replace(/./g, (c, i) => i < pin.length ? '*' : '•')}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px'}}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handlePress(n)} style={{...styles.pinBtn, borderColor: theme.primary, color: theme.primary}}>{n}</button>
          ))}
          <button onClick={() => setPin('')} style={{...styles.pinBtn, borderColor: 'red', color: 'red'}}>C</button>
          <button onClick={() => handlePress(0)} style={{...styles.pinBtn, borderColor: theme.primary, color: theme.primary}}>0</button>
          <button style={{...styles.pinBtn, borderColor: theme.primary, color: theme.primary}}>↵</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [locked, setLocked] = useState(true); // Default: LOCKED
  const [currentTheme, setCurrentTheme] = useState('green'); // Default: GREEN

  // Theme Cycler
  const toggleTheme = () => {
    const keys = Object.keys(THEMES);
    const nextIndex = (keys.indexOf(currentTheme) + 1) % keys.length;
    setCurrentTheme(keys[nextIndex]);
  };

  const themeStyle = THEMES[currentTheme];

  if (locked) {
    return <PinPad onUnlock={() => setLocked(false)} theme={themeStyle} />;
  }

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={setUser} theme={themeStyle} />
      ) : (
        <ChatRoom 
          user={user} 
          logout={() => setUser(null)} 
          theme={themeStyle} 
          toggleTheme={toggleTheme} // Pass the ability to change color
        />
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'monospace' },
  pinBtn: { background: 'transparent', border: '1px solid', padding: '20px', fontSize: '20px', cursor: 'pointer', borderRadius: '5px' }
};

export default App;