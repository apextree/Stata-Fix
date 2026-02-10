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
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error fetching session:', error);
      }
      setSession(data?.session || null);

      if (data?.session?.user) {
        await loadProfile(data.session.user.id);
      } else {
        setUser(null);
      }

      setLoading(false);
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          await loadProfile(newSession.user.id);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, cumulative_points')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
      return null;
    }

    setUser(data);
    return data;
  };

  const register = async (email, username, password) => {
    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existingUser) {
        throw new Error('Username already exists');
      }

      const redirectTo = window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: redirectTo
        }
      });

      if (error) throw error;

      return { success: true, needsEmailConfirmation: !data.session };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data.user) {
        throw new Error(error?.message || 'Invalid email or password');
      }

      await loadProfile(data.user.id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
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
    isAuthenticated: !!session?.user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
