import { useState, useEffect } from 'react';
import api from '../services/api';
import { initiateSocket, disconnectSocket } from '../services/socket';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.user);
          initiateSocket();
        } catch { localStorage.removeItem('auth_token'); }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const authenticate = async (type, payload) => {
    try {
      const endpoint = type === 'login' ? '/auth/login' : '/auth/register';
      const res = await api.post(endpoint, payload);
      localStorage.setItem('auth_token', res.data.token);
      setUser(res.data.user);
      initiateSocket();
      return { success: true };
    } catch (err) { return { success: false, error: err.response?.data?.error || 'Failed' }; }
  };

  const logout = () => { localStorage.removeItem('auth_token'); disconnectSocket(); setUser(null); };
  return { user, loading, authenticate, logout };
};