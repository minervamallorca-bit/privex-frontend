import React, { useState, useEffect } from 'react';
import ChatRoom from './components/ChatRoom';
import Login from './components/Login';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. On Startup: We DON'T auto-login anymore. We wait for PIN entry.
  useEffect(() => {
    // Just check if credentials EXIST, but don't set 'user' yet.
    // This forces the Login screen to appear so they can enter the PIN.
    setLoading(false);
  }, []);

  // 2. When Login.js says "PIN Valid":
  const handleLogin = (userData) => {
    setUser(userData); 
    // We don't need to save to localStorage here, Login.js already did it.
  };

  const handleLogout = () => {
    setUser(null); // Just go back to PIN screen
    // Do NOT remove 'privex_credentials' unless they do a Hard Reset.
  };

  if (loading) return <div style={{background:'#000', height:'100vh'}} />;

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