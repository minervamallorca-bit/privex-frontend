import { useState, useEffect } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';

export const useChat = (conversationId) => {
  const [messages, setMessages] = useState([]);
  const socket = getSocket();

  useEffect(() => {
    if (!conversationId) return;
    api.get('/chat/' + conversationId + '/messages')
       .then(res => setMessages(res.data.messages || []))
       .catch(console.error);
       
    if (socket) {
      socket.emit('join_conversation', conversationId);
      const handleNewMsg = (msg) => setMessages(prev => [...prev, msg]);
      socket.on('new_message', handleNewMsg);
      return () => socket.off('new_message', handleNewMsg);
    }
  }, [conversationId, socket]);

  const sendMessage = (content) => { 
    if (socket && content.trim()) socket.emit('send_message', { conversationId, content }); 
  };
  return { messages, sendMessage };
};