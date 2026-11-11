import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole, ModuleKey } from '../types';
import { canAccessModule } from '../lib/permissions';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchDevRole?: (role: UserRole) => void;
  canAccess: (module: ModuleKey) => boolean;
  isMockSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Perfil de demonstração local quando o Supabase ainda não estiver conectado com banco real
const DEFAULT_DEMO_PROFILE: UserProfile = {
  id: 'demo-admin-id',
  email: 'admin@geniantis.com',
  full_name: 'Administrador Geniantis',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMockSession, setIsMockSession] = useState<boolean>(!isSupabaseConfigured);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.warn('Perfil não encontrado no banco, usando dados padrão de consulta', error);
        setProfile({
          id: userId,
          email: email,
          full_name: email.split('@')[0],
          role: 'consulta',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        setProfile(data as UserProfile);
      }
    } catch (err) {
      console.error('Erro ao buscar perfil:', err);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Modo Demonstração / Desenvolvimento Local inicial
      const savedRole = (localStorage.getItem('geniantis_dev_role') as UserRole) || 'admin';
      setUser({ id: 'demo-user-id', email: `${savedRole}@geniantis.com` });
      setProfile({
        ...DEFAULT_DEMO_PROFILE,
        email: `${savedRole}@geniantis.com`,
        full_name: `Usuário (${savedRole.toUpperCase()})`,
        role: savedRole,
      });
      setIsMockSession(true);
      setLoading(false);
      return;
    }

    // Modo com Supabase Real
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || '');
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    if (!isSupabaseConfigured) {
      // Login em modo de demonstração
      let detectedRole: UserRole = 'admin';
      if (email.includes('ti')) detectedRole = 'ti';
      else if (email.includes('rh')) detectedRole = 'rh';
      else if (email.includes('fin')) detectedRole = 'financeiro';
      else if (email.includes('cons')) detectedRole = 'consulta';

      localStorage.setItem('geniantis_dev_role', detectedRole);
      setUser({ id: 'demo-user-id', email });
      setProfile({
        ...DEFAULT_DEMO_PROFILE,
        email,
        full_name: email.split('@')[0],
        role: detectedRole,
      });
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      localStorage.removeItem('geniantis_dev_role');
      setUser(null);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const switchDevRole = (role: UserRole) => {
    localStorage.setItem('geniantis_dev_role', role);
    setProfile(prev => prev ? { ...prev, role, email: `${role}@geniantis.com` } : null);
  };

  const canAccess = (module: ModuleKey) => {
    if (!profile) return false;
    return canAccessModule(profile.role, module);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        switchDevRole,
        canAccess,
        isMockSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
