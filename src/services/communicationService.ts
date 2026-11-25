import { supabase } from '../lib/supabase';
import { callEmailFunction } from './emailService';

export type CommunicationStatus = 'enviando' | 'enviado' | 'com_falhas';
export type RecipientStatus = 'pendente' | 'enviado' | 'falhou';

export interface Communication {
  id: string;
  subject: string;
  body: string;
  body_html: string;
  attachment_path: string | null;
  attachment_name: string | null;
  audience: string;
  status: CommunicationStatus;
  total: number;
  sent_count: number;
  failed_count: number;
  created_by_name: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface CommunicationRecipient {
  id: string;
  employee_id: string | null;
  name: string;
  email: string;
  status: RecipientStatus;
  error: string | null;
  sent_at: string | null;
}

export interface RecipientCandidate {
  id: string;
  name: string;
  email: string;
  department: string;
  unit: string;
  status: 'ativo' | 'afastado' | 'desligado';
}

export interface BatchResult {
  sent: number;
  failed: number;
  pending: number;
  total: number;
  status: CommunicationStatus;
}

const BUCKET = 'communication-files';
const MISSING_TABLE = 'Rode a migration 20261118000029_communications.sql no Supabase para liberar os Comunicados.';

const friendly = (message: string) =>
  /communications|communication_recipients/.test(message) && /does not exist|schema cache|not find/i.test(message) ? MISSING_TABLE : message;

export const CommunicationService = {
  /** Funcionários que podem receber (desligados ficam de fora) */
  async listCandidates(): Promise<RecipientCandidate[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, preferential_name, email, department_name, unit_name, status')
      .neq('status', 'desligado')
      .order('full_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      id: r.id,
      name: r.preferential_name || r.full_name,
      email: String(r.email || '').trim(),
      department: r.department_name || 'Sem departamento',
      unit: r.unit_name || 'Sem unidade',
      status: r.status,
    }));
  },

  async list(): Promise<Communication[]> {
    const { data, error } = await supabase.from('communications').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error(friendly(error.message));
    return (data || []) as Communication[];
  },

  async recipients(communicationId: string): Promise<CommunicationRecipient[]> {
    const { data, error } = await supabase
      .from('communication_recipients')
      .select('id, employee_id, name, email, status, error, sent_at')
      .eq('communication_id', communicationId)
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []) as CommunicationRecipient[];
  },

  async uploadAttachment(file: File): Promise<{ path: string; name: string }> {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) throw new Error(`Não foi possível carregar o anexo: ${error.message}`);
    return { path, name: file.name };
  },

  async attachmentUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw new Error(error?.message || 'Não foi possível abrir o anexo.');
    return data.signedUrl;
  },

  /** Grava o comunicado e a lista de destinatários; o envio vem depois, em lotes */
  async create(input: {
    subject: string; body: string; body_html: string; audience: string;
    attachment: { path: string; name: string } | null;
    recipients: { employee_id: string; name: string; email: string }[];
    created_by_name: string;
  }): Promise<Communication> {
    const { data, error } = await supabase.from('communications').insert({
      subject: input.subject,
      body: input.body,
      body_html: input.body_html,
      audience: input.audience,
      attachment_path: input.attachment?.path || null,
      attachment_name: input.attachment?.name || null,
      total: input.recipients.length,
      created_by_name: input.created_by_name,
    }).select().single();
    if (error) throw new Error(friendly(error.message));

    const rows = input.recipients.map((r) => ({ ...r, communication_id: data.id }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e } = await supabase.from('communication_recipients').insert(rows.slice(i, i + 500));
      if (e) throw new Error(e.message);
    }
    return data as Communication;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('communications').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /** Conta que envia os comunicados (null = ainda não configurada no servidor) */
  sender(): Promise<{ address: string | null }> {
    return callEmailFunction({ action: 'broadcast_sender' });
  },

  /** O servidor monta o HTML a partir do texto (não aceita HTML pronto do navegador) */
  sendTest(input: { subject: string; body: string; attachment: { path: string; name: string } | null }): Promise<{ to: string }> {
    return callEmailFunction({
      action: 'broadcast_test',
      subject: input.subject,
      body: input.body,
      attachment_path: input.attachment?.path || null,
      attachment_name: input.attachment?.name || null,
    });
  },

  sendBatch(communicationId: string, retryFailed = false): Promise<BatchResult> {
    return callEmailFunction({ action: 'broadcast_batch', communication_id: communicationId, retry_failed: retryFailed });
  },
};
