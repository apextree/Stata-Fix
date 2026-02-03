import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../client';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    
    const savedUser = localStorage.getItem('statafix_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const register = async (username, password) => {
    try {
      
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        throw new Error('Username already exists');
      }

      
      const passwordHash = await hashPassword(password);

      
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          username,
          password_hash: passwordHash,
          cumulative_points: 0
        })
        .select()
        .single();

      if (error) throw error;

      const userData = { id: data.id, username: data.username, cumulative_points: data.cumulative_points };
      setUser(userData);
      localStorage.setItem('statafix_user', JSON.stringify(userData));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const login = async (username, password) => {
    try {
      // Hash password to compare
      const passwordHash = await hashPassword(password);

      // Find user with matching username and password
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, cumulative_points')
        .eq('username', username)
        .eq('password_hash', passwordHash)
        .single();

      if (error || !data) {
        throw new Error('Invalid username or password');
      }

      const userData = { id: data.id, username: data.username, cumulative_points: data.cumulative_points };
      setUser(userData);
      localStorage.setItem('statafix_user', JSON.stringify(userData));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('statafix_user');
  };

  const refreshUserPoints = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('cumulative_points')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        const updatedUser = { ...user, cumulative_points: data.cumulative_points };
        setUser(updatedUser);
        localStorage.setItem('statafix_user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error refreshing user points:', error);
    }
  };

  const value = {
    user,
    loading,
    register,
    login,
    logout,
    refreshUserPoints,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
