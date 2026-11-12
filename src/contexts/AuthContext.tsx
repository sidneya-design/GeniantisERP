import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole, ModuleKey } from '../types';
import { canAccessModule, canLogin } from '../lib/permissions';
import { clearParabensflowSession, fetchParabensflowSession, storeParabensflowSession } from '../lib/parabensflowSso';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchDevRole?: (role: UserRole) => void;
  canAccess: (module: ModuleKey) => boolean;
  isMockSession: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_DEMO_PROFILE: UserProfile = {
  id: 'demo-admin-id',
  email: 'admin@geniantis.com',
  full_name: 'Administrador Geral',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Registra entrada/saída no log de auditoria (falha silenciosa: não bloqueia o login)
async function logSessionEvent(userId: string, action: 'login' | 'logout') {
  try {
    const { data: p } = await supabase.from('profiles').select('email, full_name').eq('id', userId).single();
    await supabase.from('audit_logs').insert({
      user_id: userId,
      user_email: p?.email ?? null,
      user_name: p?.full_name ?? null,
      action,
      entity: 'sessao',
      summary: action === 'login' ? 'Entrou no sistema' : 'Saiu do sistema',
    });
  } catch {
    // ignora
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isMockSession, setIsMockSession] = useState<boolean>(!isSupabaseConfigured);

  const syncParabensflowSSO = (email: string, role: UserRole) => {
    if (!isSupabaseConfigured) {
      // Modo demo: sem Supabase não há como validar no servidor; o painel usa a prévia local.
      const pfRole = role === 'admin' ? 'admin' : role === 'adm' || role === 'rh' ? 'editor' : 'viewer';
      storeParabensflowSession({ token: 'sso-demo-' + btoa(email), email, role: pfRole });
      return;
    }
    void fetchParabensflowSession();
  };

  const clearParabensflowSSO = () => clearParabensflowSession();

  const fetchProfile = async (userId: string, email: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        setProfile(null);
        clearParabensflowSSO();
        return;
      }

      if (!data || !data.is_active || !canLogin(data.role)) {
        // Perfil inativo ou sem permissão de login: encerra a sessão
        setProfile(null);
        clearParabensflowSSO();
        await supabase.auth.signOut();
        return;
      }

      const loadedProfile = data as UserProfile;
      setProfile(loadedProfile);
      syncParabensflowSSO(loadedProfile.email, loadedProfile.role);
    } catch (err) {
      console.error('Erro ao buscar perfil:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const rawRole = localStorage.getItem('geniantis_dev_role') || 'admin';
      const validRoles: UserRole[] = ['admin', 'adm', 'ti', 'rh', 'financeiro', 'consulta'];
      const savedRole: UserRole = validRoles.includes(rawRole as UserRole) ? (rawRole as UserRole) : 'admin';
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
      let detectedRole: UserRole = 'admin';
      const lower = email.toLowerCase();
      if (lower.startsWith('adm@') || lower.includes('adm.')) detectedRole = 'adm';
      else if (lower.includes('ti')) detectedRole = 'ti';
      else if (lower.includes('rh')) detectedRole = 'rh';
      else if (lower.includes('fin')) detectedRole = 'financeiro';
      else if (lower.includes('cons')) detectedRole = 'consulta';
      else detectedRole = 'admin';

      localStorage.setItem('geniantis_dev_role', detectedRole);
      setUser({ id: 'demo-user-id', email });
      setProfile({
        ...DEFAULT_DEMO_PROFILE,
        email,
        full_name: `Usuário (${detectedRole.toUpperCase()})`,
        role: detectedRole,
      });
      syncParabensflowSSO(email, detectedRole);
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) return { error: error as Error };

    // Confere o perfil antes de liberar a entrada
    const { data: perfil } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', data.user.id)
      .single();

    if (!perfil || !perfil.is_active || !canLogin(perfil.role)) {
      await supabase.auth.signOut();
      return {
        error: new Error(
          !perfil || !perfil.is_active
            ? 'Seu usuário está inativo. Fale com o administrador.'
            : 'Seu perfil não tem acesso ao ERP. Fale com o administrador.'
        ),
      };
    }

    void logSessionEvent(data.user.id, 'login');
    return { error: null };
  };

  const signOut = async () => {
    clearParabensflowSSO();
    if (isSupabaseConfigured && user?.id) await logSessionEvent(user.id, 'logout');
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
    // Só no modo demonstração (sem Supabase): no sistema real o perfil vem do banco
    if (isSupabaseConfigured) return;
    localStorage.setItem('geniantis_dev_role', role);
    const email = `${role}@geniantis.com`;
    setProfile(prev => prev ? { ...prev, role, email, full_name: `Usuário (${role.toUpperCase()})` } : null);
    syncParabensflowSSO(email, role);
  };

  const refreshProfile = async () => {
    if (isSupabaseConfigured && user?.id) await fetchProfile(user.id, user.email || '');
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
        // Enquanto há sessão mas o perfil ainda não carregou, a tela fica em
        // "carregando" (evita piscar "Acesso restrito" ao recarregar)
        loading: loading || (!!user && !profile && profileLoading),
        signIn,
        signOut,
        switchDevRole,
        canAccess,
        isMockSession,
        refreshProfile,
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
