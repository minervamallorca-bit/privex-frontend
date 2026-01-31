import React, { useState, useEffect } from 'react';
import ChatRoom from './components/ChatRoom';
import Login from './components/Login';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Prevents flickering

  // 1. RUNS WHEN APP STARTS
  useEffect(() => {
    // Check if we have a saved user in the hard drive
    const savedUser = localStorage.getItem('privex_user');
    
    if (savedUser) {
      console.log("Found saved user:", savedUser); // Debugging
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // 2. SAVES USER WHEN LOGGING IN
  const handleLogin = (userData) => {
    console.log("Saving user to disk:", userData);
    localStorage.setItem('privex_user', JSON.stringify(userData));
    setUser(userData);
  };

  // 3. WIPES DATA WHEN LOGGING OUT
  const handleLogout = () => {
    localStorage.removeItem('privex_user');
    setUser(null);
  };

  // Show a black screen while checking memory (so you don't see login for 0.1s)
  if (loading) return <div style={{backgroundColor: '#121212', height: '100vh'}} />;

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