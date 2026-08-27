import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { getUserProfile, updateUserProfile, authLogin, authRegister } from '../api';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, invitationCode: string, password?: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const { showToast } = useToast();

  const loadUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const isAuthSaved = localStorage.getItem('mudrexx_authenticated');
      if (isAuthSaved === 'true') {
        const profile = await getUserProfile();
        setUser(profile);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      console.warn('Authentication load error:', err);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Default to auto-login Alexander Wright for smooth preview experience if not explicitly logged out
    const authFlag = localStorage.getItem('mudrexx_authenticated');
    if (authFlag === null) {
      localStorage.setItem('mudrexx_authenticated', 'true');
    }
    loadUser();
  }, [loadUser]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authLogin(email, pass);
      localStorage.setItem('mudrexx_token', res.token);
      localStorage.setItem('mudrexx_authenticated', 'true');
      setUser(res.user);
      setIsAuthenticated(true);
      showToast('success', 'Authentication Successful', `Welcome back, ${res.user.name}`);
    } catch (err: any) {
      showToast('error', 'Authentication Failed', err.message || 'Invalid credentials');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, invitationCode: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await authRegister({ name, email, invitationCode, password });
      localStorage.setItem('mudrexx_token', res.token);
      localStorage.setItem('mudrexx_authenticated', 'true');
      setUser(res.user);
      setIsAuthenticated(true);
      showToast('success', 'Account Enrolled', `Welcome to Mudrexx Earn, ${res.user.name}`);
    } catch (err: any) {
      showToast('error', 'Registration Failed', err.message || 'Could not verify invitation code');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('mudrexx_token');
    localStorage.setItem('mudrexx_authenticated', 'false');
    setUser(null);
    setIsAuthenticated(false);
    showToast('info', 'Signed Out', 'You have been signed out from the training terminal.');
  };

  const updateUser = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    const updated = await updateUserProfile(updates);
    setUser(updated);
    showToast('success', 'Profile Updated', 'Your institutional profile details have been saved.');
    return updated;
  };

  const refreshProfile = async () => {
    try {
      const profile = await getUserProfile();
      setUser(profile);
    } catch (err) {
      console.error('Refresh profile error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
