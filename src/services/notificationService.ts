import { supabase } from '../lib/supabase';
import { callEmailFunction } from './emailService';

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const missing = (m: string) => /notifications/.test(m) && /exist|schema cache|not find|Could not find/i.test(m);

export const NotificationService = {
  /** Avisos mais recentes da pessoa logada (vazio se a tabela ainda não existe) */
  async list(limit = 30): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, kind, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      if (missing(error.message)) return [];
      throw new Error(error.message);
    }
    return (data || []) as AppNotification[];
  },

  async markRead(ids?: string[]): Promise<void> {
    const { error } = await supabase.rpc('notifications_mark_read', { p_ids: ids && ids.length ? ids : null });
    if (error && !missing(error.message)) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /**
   * Pede ao servidor para mandar por e-mail os avisos que a própria pessoa acabou de gerar.
   * Não atrapalha a tela: no localhost (sem as funções da Netlify) ou com erro, só ignora.
   */
  flushEmails(): void {
    callEmailFunction({ action: 'agenda_notify' }).catch(() => undefined);
  },

  async emailEnabled(userId: string): Promise<boolean> {
    const { data } = await supabase.from('profiles').select('notify_email').eq('id', userId).maybeSingle();
    return data?.notify_email !== false;
  },

  /** Avisos de atividades (atribuição e lembretes), no sino e por e-mail */
  async activitiesEnabled(userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('profiles').select('notify_activities').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.notify_activities !== false;
  },

  async setActivitiesEnabled(userId: string, on: boolean): Promise<void> {
    const { error } = await supabase.from('profiles').update({ notify_activities: on }).eq('id', userId);
    if (error) throw new Error(/notify_activities/.test(error.message) ? 'Rode a migration 20261124000052_notify_activities.sql no Supabase para ativar esta opção.' : error.message);
  },

  async setEmailEnabled(userId: string, on: boolean): Promise<void> {
    const { error } = await supabase.from('profiles').update({ notify_email: on }).eq('id', userId);
    if (error) throw new Error(/notify_email/.test(error.message) ? 'Rode a migration 20261123000044 no Supabase para ativar esta opção.' : error.message);
  },
};
