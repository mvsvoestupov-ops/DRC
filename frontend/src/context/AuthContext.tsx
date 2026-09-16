import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { AuthState, User } from '../api/types';
import { apiClient } from '../api/client';

const ADMIN_TOKEN_KEY = 'admin_token';
const ADMIN_ROLE_KEY = 'admin_role';
const ADMIN_EMAIL_KEY = 'admin_email';
const IMPERSONATING_KEY = 'impersonating_email';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  impersonate: (userId: number) => Promise<void>;
  stopImpersonation: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearSessionStorage() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_ROLE_KEY);
  localStorage.removeItem(ADMIN_EMAIL_KEY);
  localStorage.removeItem(IMPERSONATING_KEY);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [impersonatorEmail, setImpersonatorEmail] = useState<string | null>(
    localStorage.getItem(IMPERSONATING_KEY),
  );

  const logout = useCallback(() => {
    clearSessionStorage();
    setToken(null);
    setUser(null);
    setImpersonatorEmail(null);
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
      .then((me) => setUser(me))
      .catch(() => setUser({ email: '', role }))
      .finally(() => setLoading(false));
  }, [token]);

  const refreshUser = async () => {
    const me = await apiClient.getMe();
    setUser(me);
    if (me.role) localStorage.setItem('role', me.role);
  };

  const login = async (email: string, password: string): Promise<void> => {
    const { access_token, role } = await apiClient.login(email, password);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_ROLE_KEY);
    localStorage.removeItem(ADMIN_EMAIL_KEY);
    localStorage.removeItem(IMPERSONATING_KEY);
    localStorage.setItem('token', access_token);
    localStorage.setItem('role', role);
    setImpersonatorEmail(null);
    setToken(access_token);
    setUser({ email, role });
    apiClient.getMe().then(setUser).catch(() => undefined);
  };

  const impersonate = async (userId: number) => {
    const data = await apiClient.impersonateUser(userId);
    const currentToken = localStorage.getItem('token');
    const currentRole = localStorage.getItem('role') || user?.role || 'admin';
    if (currentToken && !localStorage.getItem(ADMIN_TOKEN_KEY)) {
      localStorage.setItem(ADMIN_TOKEN_KEY, currentToken);
      localStorage.setItem(ADMIN_ROLE_KEY, currentRole);
      localStorage.setItem(ADMIN_EMAIL_KEY, user?.email || '');
    }
    localStorage.setItem(IMPERSONATING_KEY, data.impersonator);
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('role', data.role);
    setImpersonatorEmail(data.impersonator);
    setToken(data.access_token);
    setUser({ email: data.email, role: data.role });
    apiClient.getMe().then(setUser).catch(() => undefined);
  };

  const stopImpersonation = () => {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    const adminRole = localStorage.getItem(ADMIN_ROLE_KEY) || 'admin';
    const adminEmail = localStorage.getItem(ADMIN_EMAIL_KEY) || '';
    if (!adminToken) {
      logout();
      return;
    }
    localStorage.setItem('token', adminToken);
    localStorage.setItem('role', adminRole);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_ROLE_KEY);
    localStorage.removeItem(ADMIN_EMAIL_KEY);
    localStorage.removeItem(IMPERSONATING_KEY);
    setImpersonatorEmail(null);
    setToken(adminToken);
    setUser({ email: adminEmail, role: adminRole });
    apiClient.getMe().then(setUser).catch(() => undefined);
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    impersonate,
    stopImpersonation,
    refreshUser,
    loading,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
    isExpert: user?.role === 'admin' || user?.role === 'expert',
    isModerator: user?.role === 'admin' || user?.role === 'moderator',
    isStaff: user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'expert',
    isImpersonating: Boolean(impersonatorEmail),
    impersonatorEmail,
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
