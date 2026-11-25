import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface EmailSettings {
  sender_name: string;
  reply_to: string;
  signature: string;
  alerts_enabled: boolean;
  alert_recipients: string[];
  alert_days: number[];
  alert_domains: boolean;
  alert_contracts: boolean;
  alert_subscriptions: boolean;
  alert_maintenance: boolean;
  term_email_enabled: boolean;
  term_subject: string;
  term_body: string;
  comm_sender_name?: string;
  comm_reply_to?: string;
  comm_signature?: string;
  updated_at?: string;
}

export interface AlertItem {
  grupo: 'dominio' | 'contrato' | 'assinatura' | 'manutencao';
  key: string;
  titulo: string;
  detalhe: string;
  vencimento: string;
  dias: number;
  prazo: string;
  ja_avisado?: boolean;
}

export const ALERT_GROUP_LABEL: Record<AlertItem['grupo'], string> = {
  dominio: 'Domínio',
  contrato: 'Contrato',
  assinatura: 'Assinatura',
  manutencao: 'Manutenção',
};

export const TERM_PLACEHOLDERS = [
  { key: 'nome', label: 'Primeiro nome' },
  { key: 'nome_completo', label: 'Nome completo' },
  { key: 'tipo', label: 'entrega / devolução' },
  { key: 'data', label: 'Data da movimentação' },
  { key: 'itens', label: 'Lista de itens' },
];

const EDITABLE: (keyof EmailSettings)[] = [
  'sender_name', 'reply_to', 'signature', 'alerts_enabled', 'alert_recipients', 'alert_days',
  'alert_domains', 'alert_contracts', 'alert_subscriptions', 'alert_maintenance',
  'term_email_enabled', 'term_subject', 'term_body',
  'comm_sender_name', 'comm_reply_to', 'comm_signature',
];

export async function callEmailFunction<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente.');

  let res: Response;
  try {
    res = await fetch('/.netlify/functions/send-email', {
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
    throw new Error('Envio de e-mail indisponível neste ambiente. Use o site publicado ou `npm run dev:netlify`.');
  }
  if (!res.ok) throw new Error(json.error || `Erro no servidor (HTTP ${res.status})`);
  return json as T;
}

export const EmailService = {
  async getSettings(): Promise<EmailSettings | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.from('email_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as EmailSettings) || null;
  },

  async saveSettings(settings: EmailSettings, userId?: string): Promise<EmailSettings> {
    const changes: Record<string, unknown> = { updated_by: userId || null };
    // Campos que ainda não existem no banco (migration não rodada) ficam de fora
    EDITABLE.forEach((k) => { if (settings[k] !== undefined) changes[k] = settings[k]; });
    const { data, error } = await supabase.from('email_settings').update(changes).eq('id', 1).select().single();
    if (error) throw new Error(error.message);
    return data as EmailSettings;
  },

  sendTest(to: string): Promise<{ to: string }> {
    return callEmailFunction({ action: 'test', to });
  },

  sendTerm(movementId: string): Promise<{ to: string; sent_at: string }> {
    return callEmailFunction({ action: 'term', movement_id: movementId });
  },

  previewAlerts(): Promise<{ message: string; destinatarios: string[]; itens: AlertItem[] }> {
    return callEmailFunction({ action: 'alerts', dry_run: true });
  },

  runAlerts(): Promise<{ message: string; enviados: number; itens: AlertItem[] }> {
    return callEmailFunction({ action: 'alerts' });
  },
};
