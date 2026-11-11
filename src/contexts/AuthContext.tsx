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

  const syncParabensflowSSO = (email: string, role: UserRole) => {
    const pfRole = role === 'admin' ? 'admin' : role === 'ti' || role === 'rh' ? 'editor' : 'viewer';
    const pfToken = 'sso-geniantis-' + btoa(email);

    sessionStorage.setItem('parabensflow_token', pfToken);
    sessionStorage.setItem('parabensflow_email', email);
    sessionStorage.setItem('parabensflow_role', pfRole);

    localStorage.setItem('parabensflow_token', pfToken);
    localStorage.setItem('parabensflow_email', email);
    localStorage.setItem('parabensflow_role', pfRole);
    localStorage.setItem('geniantis_token', pfToken);
    localStorage.setItem('geniantis_email', email);
    localStorage.setItem('geniantis_role', pfRole);
  };

  const clearParabensflowSSO = () => {
    sessionStorage.removeItem('parabensflow_token');
    sessionStorage.removeItem('parabensflow_email');
    sessionStorage.removeItem('parabensflow_role');
    localStorage.removeItem('parabensflow_token');
    localStorage.removeItem('parabensflow_email');
    localStorage.removeItem('parabensflow_role');
    localStorage.removeItem('geniantis_token');
    localStorage.removeItem('geniantis_email');
    localStorage.removeItem('geniantis_role');
  };

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.warn('Perfil não encontrado no banco, usando dados padrão de consulta', error);
        const fallbackProfile: UserProfile = {
          id: userId,
          email: email,
          full_name: email.split('@')[0],
          role: 'consulta',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProfile(fallbackProfile);
        syncParabensflowSSO(email, 'consulta');
      } else {
        const loadedProfile = data as UserProfile;
        setProfile(loadedProfile);
        syncParabensflowSSO(loadedProfile.email, loadedProfile.role);
      }
    } catch (err) {
      console.error('Erro ao buscar perfil:', err);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Modo Demonstração / Desenvolvimento Local inicial
      const savedRole = (localStorage.getItem('geniantis_dev_role') as UserRole) || 'admin';
      const email = `${savedRole}@geniantis.com`;
      setUser({ id: 'demo-user-id', email });
      setProfile({
        ...DEFAULT_DEMO_PROFILE,
        email,
        full_name: `Usuário (${savedRole.toUpperCase()})`,
        role: savedRole,
      });
      syncParabensflowSSO(email, savedRole);
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
        clearParabensflowSSO();
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
      syncParabensflowSSO(email, detectedRole);
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (!error && data?.user) {
      // Perfil será carregado pelo listener onAuthStateChange ou fetchProfile
      syncParabensflowSSO(email, 'admin');
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    clearParabensflowSSO();
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
    const email = `${role}@geniantis.com`;
    setProfile(prev => prev ? { ...prev, role, email } : null);
    syncParabensflowSSO(email, role);
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

