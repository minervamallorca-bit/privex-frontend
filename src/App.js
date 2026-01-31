import React, { useState, useEffect } from 'react';
import ChatRoom from './components/ChatRoom';
import Login from './components/Login';

function App() {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true); // Prevents "flicker"

  // CHECK MEMORY ON STARTUP
  useEffect(() => {
    const savedUser = localStorage.getItem('privex_session');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsChecking(false);
  }, []);

  // SAVE TO MEMORY ON LOGIN
  const handleLogin = (userData) => {
    localStorage.setItem('privex_session', JSON.stringify(userData));
    setUser(userData);
  };

  // WIPE MEMORY ON LOGOUT
  const handleLogout = () => {
    localStorage.removeItem('privex_session');
    setUser(null);
  };

  if (isChecking) return <div style={{background:'#121212', height:'100vh'}} />;

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <ChatRoom user={user} logout={handleLogout} />
      )}
    </div>
  );
}

export default App;