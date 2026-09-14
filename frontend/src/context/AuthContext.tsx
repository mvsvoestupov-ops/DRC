import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { AuthState, User } from '../api/types';
import { apiClient } from '../api/client';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const onLogout = () => logout();
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    const role = localStorage.getItem('role') || 'user';
    apiClient.getMe()
      .then((me) => setUser({ email: me.email, role: me.role }))
      .catch(() => setUser({ email: '', role }))
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { access_token, role } = await apiClient.login(email, password);
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', role);
      setToken(access_token);
      setUser({ email, role });
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    loading,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
