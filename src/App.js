import React, { useState } from 'react';
import Login from './components/Login';
import ChatRoom from './components/ChatRoom';
import './App.css';

// FORCE RESTORE V4
function App() {
  const [user, setUser] = useState(null);

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={setUser} />
      ) : (
        <ChatRoom user={user} logout={() => setUser(null)} />
      )}
    </div>
  );
}

export default App;