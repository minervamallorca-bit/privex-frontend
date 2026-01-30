import { useState } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // This function simulates a login without a real server
  const authenticate = async (type, data) => {
    console.log("Simulating " + type + " for:", data);
    
    // 1. Fake a small loading delay (1 second)
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. Set a fake user into memory
    setUser({ 
      fullName: data.fullName || 'Test User', 
      email: data.email 
    });
    
    setLoading(false);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
  };

  return { user, loading, authenticate, logout };
};