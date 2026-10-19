import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthUser, SignInPayload, SignUpPayload } from '../types/auth';
import { UserRole } from '../types/database';
import { authService } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isDemoMode: boolean;
  isLoading: boolean;
  login: (payload: SignInPayload) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  loginDemoSuperAdmin: () => { success: boolean; user?: AuthUser; error?: string };
  register: (payload: SignUpPayload) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  logout: () => Promise<void>;
  switchUserDemo: (role: UserRole) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = () => {
    const current = authService.getCurrentUser();
    setUser(current);
  };

  useEffect(() => {
    refreshUser();
    setIsLoading(false);
  }, []);

  const login = async (payload: SignInPayload) => {
    setIsLoading(true);
    const res = await authService.login(payload);
    if (res.success && res.user) {
      setUser(res.user);
    }
    setIsLoading(false);
    return res;
  };

  const register = async (payload: SignUpPayload) => {
    setIsLoading(true);
    const res = await authService.register(payload);
    if (res.success && res.user) {
      setUser(res.user);
    }
    setIsLoading(false);
    return res;
  };

  const logout = async () => {
    setIsLoading(true);
    await authService.logout();
    setUser(null);
    setIsLoading(false);
  };

  const loginDemoSuperAdmin = () => {
    const res = authService.loginAsDemoSuperAdmin();
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const switchUserDemo = (targetRole: UserRole) => {
    let email = 'admin@darulhikmah.sch.id';
    let name = 'Ustadz H. Ahmad Fauzan (Super Admin)';
    let userId = 'usr-super-admin';

    if (targetRole === 'PANITIA') {
      email = 'panitia@darulhikmah.sch.id';
      name = 'Ustadz Ridwan Robbani (Panitia PSB)';
      userId = 'usr-panitia-1';
    } else if (targetRole === 'PENGUJI_QURAN') {
      email = 'penguji.quran@darulhikmah.sch.id';
      name = 'Ustadz KH. Muhaimin Al-Hafidz (Penguji Qur\'an)';
      userId = 'usr-penguji-quran-1';
    } else if (targetRole === 'PIMPINAN') {
      email = 'pimpinan@darulhikmah.sch.id';
      name = 'KH. Abdullah Syukri, M.Pd (Pimpinan)';
      userId = 'usr-pimpinan-1';
    } else if (targetRole === 'PESERTA') {
      email = 'farhan@example.com';
      name = 'Muhammad Farhan Al-Ghifari';
      userId = 'usr-sample-candidate';
    }

    const demoUser: AuthUser = {
      id: userId,
      email,
      role: targetRole,
      profile: {
        id: `prof-${targetRole.toLowerCase()}`,
        user_id: userId,
        full_name: name,
        email,
        phone: '081234567890',
        role: targetRole,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    try { localStorage.setItem('psb_active_session_user', JSON.stringify(demoUser)); } catch {}
    setUser(demoUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isDemoMode: Boolean(user?.isDemoMode),
        isLoading,
        login,
        loginDemoSuperAdmin,
        register,
        logout,
        switchUserDemo,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
