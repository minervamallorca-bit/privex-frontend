import React from 'react';
import './App.css';

function App() {
  return (
    <div style={{
      height: '100vh', 
      background: 'blue', 
      color: 'white', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      flexDirection: 'column',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{fontSize: '50px'}}>VERSION 6</h1>
      <h2>FIREBASE IS DISCONNECTED</h2>
      <p>If you see this, the React Engine is fine.</p>
    </div>
  );
}

export default App;