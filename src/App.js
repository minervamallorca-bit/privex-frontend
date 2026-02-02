import React, { useState } from 'react';
import Login from './components/Login';
import ChatRoom from './components/ChatRoom';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  // 🛡️ SAFE MODE THEME (Standard Green)
  const safeTheme = { 
    primary: '#00ff00', 
    bg: '#050505', 
    secondary: 'rgba(0, 255, 0, 0.1)' 
  };

  return (
    <div className="App" style={{background: safeTheme.bg, height: '100vh', color: safeTheme.primary}}>
      {!user ? (
        <Login 
          onLogin={setUser} 
          theme={safeTheme} 
        />
      ) : (
        <ChatRoom 
          user={user} 
          logout={() => setUser(null)} 
          theme={safeTheme} 
          toggleTheme={() => alert("SYSTEM RESTORED. THEMES COMING SOON.")} 
        />
      )}
    </div>
  );
}

export default App;