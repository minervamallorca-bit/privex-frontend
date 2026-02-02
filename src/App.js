import React from 'react';

// NO CSS IMPORT HERE - This prevents the crash.

function App() {
  return (
    <div style={{
      height: '100vh', 
      width: '100vw',
      background: 'red', 
      color: 'white', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      flexDirection: 'column',
      fontFamily: 'sans-serif',
      margin: 0,
      padding: 0
    }}>
      <h1 style={{fontSize: '60px', fontWeight: 'bold'}}>VERSION 7</h1>
      <h2 style={{fontSize: '30px'}}>RED SCREEN OF SUCCESS</h2>
      <p>The CSS file was the killer.</p>
    </div>
  );
}

export default App;