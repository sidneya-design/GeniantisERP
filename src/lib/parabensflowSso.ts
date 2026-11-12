import { supabase, isSupabaseConfigured } from './supabase';

export interface ParabensflowSession {
  token: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

const STORAGE_KEYS = ['parabensflow', 'geniantis'];

export function storeParabensflowSession(session: ParabensflowSession) {
  sessionStorage.setItem('parabensflow_token', session.token);
  sessionStorage.setItem('parabensflow_email', session.email);
  sessionStorage.setItem('parabensflow_role', session.role);
  for (const prefix of STORAGE_KEYS) {
    localStorage.setItem(`${prefix}_token`, session.token);
    localStorage.setItem(`${prefix}_email`, session.email);
    localStorage.setItem(`${prefix}_role`, session.role);
  }
}

export function clearParabensflowSession() {
  for (const field of ['token', 'email', 'role']) {
    sessionStorage.removeItem(`parabensflow_${field}`);
    for (const prefix of STORAGE_KEYS) localStorage.removeItem(`${prefix}_${field}`);
  }
}

let pending: { accessToken: string; promise: Promise<ParabensflowSession | null> } | null = null;

// Troca a sessão Supabase do ERP por um token assinado do painel de aniversariantes.
// Em modo demo (sem Supabase) não há como validar, então retorna null.
export async function fetchParabensflowSession(force = false): Promise<ParabensflowSession | null> {
  if (!isSupabaseConfigured) return null;

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return null;

  if (!force && pending && pending.accessToken === accessToken) return pending.promise;

  const promise = fetch('/.netlify/functions/sso', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
    .then(async (res) => {
      if (!res.ok) {
        console.error('SSO do painel de aniversariantes falhou:', res.status, await res.text());
        return null;
      }
      const session = (await res.json()) as ParabensflowSession;
      storeParabensflowSession(session);
      return session;
    })
    .catch((err) => {
      console.error('SSO do painel de aniversariantes falhou:', err);
      return null;
    });

  pending = { accessToken, promise };
  const result = await promise;
  if (!result && pending?.promise === promise) pending = null;
  return result;
}
