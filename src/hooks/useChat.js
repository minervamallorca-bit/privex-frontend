import { useState } from 'react';
import { encryptMessage } from '../services/encryption';

export const useChat = () => {
  const [messages, setMessages] = useState([
    { senderEmail: 'System', content: encryptMessage('System Online. 8K Mode Active.') }
  ]);

  const sendMessage = (text) => {
    const encrypted = encryptMessage(text);
    const newMessage = { senderEmail: 'Me', content: encrypted, timestamp: Date.now() };
    setMessages((prev) => [...prev, newMessage]);
  };

  return { messages, sendMessage };
};