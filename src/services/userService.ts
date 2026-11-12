import { supabase } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';

export const ROLE_INFO: Record<UserRole, { label: string; description: string; color: string }> = {
  admin: { label: 'Administrador', description: 'Acesso total, incluindo Configurações e Usuários', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  adm: { label: 'ADM', description: 'Tudo, menos Domínios e Configurações', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  ti: { label: 'TI', description: 'Ativos, Entregas, Manutenções e Domínios', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  rh: { label: 'RH', description: 'Visão Geral, Funcionários e Aniversariantes', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  financeiro: { label: 'Financeiro', description: 'Assinaturas e consulta de ativos e domínios', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  consulta: { label: 'Consulta', description: 'Somente leitura, sem editar nada', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

// Perfis que podem ser atribuídos (os únicos que conseguem entrar no ERP)
export const ROLE_ORDER: UserRole[] = ['admin', 'adm', 'ti', 'rh'];

async function callAdminFunction(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente.');

  let res: Response;
  try {
    res = await fetch('/.netlify/functions/admin-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Não foi possível falar com o servidor.');
  }

  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // Em `npm run dev` (sem netlify dev) a rota da function devolve o HTML do app
    throw new Error('Função do servidor indisponível neste ambiente. Use o site publicado ou `netlify dev`.');
  }
  if (!res.ok) throw new Error(json.error || `Erro no servidor (HTTP ${res.status})`);
  return json;
}

export const UserService = {
  async list(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []) as UserProfile[];
  },

  async update(id: string, changes: Partial<Pick<UserProfile, 'role' | 'is_active' | 'full_name'>>): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(changes)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as UserProfile;
  },

  async create(input: { full_name: string; email: string; role: UserRole; password: string }): Promise<UserProfile> {
    const res = await callAdminFunction({ action: 'create', ...input });
    return res.profile as UserProfile;
  },

  async resetPassword(id: string, password: string, email?: string): Promise<void> {
    await callAdminFunction({ action: 'reset_password', id, password, email });
  },
};

export function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
