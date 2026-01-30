import React, { useState } from 'react';

export default function Login({ authenticate }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const type = isRegister ? 'register' : 'login';
    const res = await authenticate(type, formData);
    if (!res.success) setError(res.error);
  };

  return (
    <div style={{padding:'50px',textAlign:'center'}}>
      <h2>{isRegister ? 'Register' : 'Login'}</h2>
      <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'10px',maxWidth:'300px',margin:'auto'}}>
        {isRegister && <input placeholder='Name' onChange={e=>setFormData({...formData,fullName:e.target.value})} />}
        <input placeholder='Email' onChange={e=>setFormData({...formData,email:e.target.value})} />
        <input type='password' placeholder='Password' onChange={e=>setFormData({...formData,password:e.target.value})} />
        <button type='submit'>Submit</button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
      <p onClick={()=>setIsRegister(!isRegister)} style={{cursor:'pointer',color:'blue'}}>Switch to {isRegister ? 'Login' : 'Register'}</p>
    </div>
  );
}