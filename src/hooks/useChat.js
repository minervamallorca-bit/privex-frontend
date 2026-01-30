import { useState, useCallback } from 'react';

export const useChat = (conversationId) => {
  const [messages, setMessages] = useState([
    { senderEmail: 'System', content: 'Welcome to the secure chat!' }
  ]);

  const sendMessage = useCallback((content) => {
    // 1. Add YOUR message to the list immediately
    const newMessage = { senderEmail: 'Me', content };
    setMessages((prev) => [...prev, newMessage]);

    // 2. Simulate a "Bot" reply after 1.5 seconds
    setTimeout(() => {
      setMessages((prev) => [
        ...prev, 
        { senderEmail: 'Bot', content: 'I received: ' + content }
      ]);
    }, 1500);

  }, []);

  return { messages, sendMessage };
};