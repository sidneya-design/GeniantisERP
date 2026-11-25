import { supabase } from '../lib/supabase';
import { callEmailFunction } from './emailService';

/** Sem registro = pendente */
export type ImageTermStatus = 'autorizado' | 'nao_autorizado' | 'pendente';

export interface ImageTerm {
  employee_id: string;
  status: Exclude<ImageTermStatus, 'pendente'>;
  signed_at: string | null;
  file_path: string | null;
  file_name: string | null;
  notes: string | null;
  emailed_at: string | null;
  emailed_to: string | null;
  updated_at: string;
}

export const IMAGE_STATUS_LABEL: Record<ImageTermStatus, string> = {
  autorizado: 'Autorizado',
  nao_autorizado: 'Não autorizado',
  pendente: 'Pendente',
};

export const IMAGE_STATUS_CLS: Record<ImageTermStatus, string> = {
  autorizado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  nao_autorizado: 'bg-rose-50 text-rose-700 border-rose-200',
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
};

const BUCKET = 'employee-documents';
const MISSING = 'Rode a migration 20261118000031_image_terms.sql no Supabase para liberar o termo de uso de imagem.';
const friendly = (m: string) => (/employee_image_terms/.test(m) && /exist|schema cache|not find/i.test(m) ? MISSING : m);

export const ImageTermService = {
  /** Todos os registros, por funcionário (quem não aparece está pendente) */
  async listAll(): Promise<Map<string, ImageTerm>> {
    const { data, error } = await supabase.from('employee_image_terms').select('*');
    if (error) throw new Error(friendly(error.message));
    return new Map(((data || []) as ImageTerm[]).map((t) => [t.employee_id, t]));
  },

  async get(employeeId: string): Promise<ImageTerm | null> {
    const { data, error } = await supabase.from('employee_image_terms').select('*').eq('employee_id', employeeId).maybeSingle();
    if (error) throw new Error(friendly(error.message));
    return (data as ImageTerm) || null;
  },

  /** Grava a situação; com arquivo novo, sobe o PDF antes */
  async save(employeeId: string, input: { status: ImageTerm['status']; signed_at: string | null; notes: string | null; file?: File | null; keepFile?: ImageTerm | null }): Promise<ImageTerm> {
    let file_path = input.keepFile?.file_path || null;
    let file_name = input.keepFile?.file_name || null;
    if (input.file) {
      const safe = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `imagem/${employeeId}/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, input.file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw new Error(`Não foi possível carregar o PDF: ${upErr.message}`);
      file_path = path;
      file_name = input.file.name;
    }
    const { data, error } = await supabase.from('employee_image_terms').upsert({
      employee_id: employeeId,
      status: input.status,
      signed_at: input.signed_at,
      notes: input.notes,
      file_path,
      file_name,
    }).select().single();
    if (error) throw new Error(friendly(error.message));
    return data as ImageTerm;
  },

  /** Volta para pendente (apaga o registro; o PDF antigo fica no histórico do bucket) */
  async reset(employeeId: string): Promise<void> {
    const { error } = await supabase.from('employee_image_terms').delete().eq('employee_id', employeeId);
    if (error) throw new Error(friendly(error.message));
  },

  async fileUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw new Error(error?.message || 'Não foi possível abrir o PDF.');
    return data.signedUrl;
  },

  sendEmail(employeeId: string): Promise<{ to: string; sent_at: string }> {
    return callEmailFunction({ action: 'image_term', employee_id: employeeId });
  },
};
