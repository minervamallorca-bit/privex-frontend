import io from 'socket.io-client';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://privexapp.gmyco.app';
let socket;
export const initiateSocket = () => {
  const token = localStorage.getItem('auth_token');
  if (!token) return;
  if (socket && socket.connected) return socket;
  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
  return socket;
};
export const getSocket = () => socket;
export const disconnectSocket = () => { if (socket) socket.disconnect(); };