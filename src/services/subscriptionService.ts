import { supabase } from '../lib/supabase';
import {
  Subscription,
  SubscriptionAssignment,
  SubscriptionInput,
  SubscriptionPeriodicity,
} from '../types/subscription';

function fail(error: { message: string; code?: string } | null): never {
  // 42P01 = tabela inexistente: a migration ainda não foi aplicada no Supabase
  if (error?.code === '42P01' || /does not exist|schema cache/i.test(error?.message || '')) {
    throw new Error('As tabelas de assinaturas ainda não existem no Supabase. Rode a migration 20261112000001_subscriptions.sql.');
  }
  throw new Error(error?.message || 'Erro desconhecido.');
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));

function mapSubscription(row: any): Subscription {
  return { ...row, amount: num(row.amount), total_licenses: num(row.total_licenses) };
}

export const SubscriptionService = {
  async list(): Promise<Subscription[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('service_name', { ascending: true });
    if (error) fail(error);
    return (data || []).map(mapSubscription);
  },

  async save(input: SubscriptionInput): Promise<Subscription> {
    const { id, ...fields } = input;
    const payload = {
      ...fields,
      provider: fields.provider || null,
      category: fields.category || null,
      renewal_date: fields.renewal_date || null,
      billing_day: fields.billing_day || null,
      admin_email: fields.admin_email || null,
      notes: fields.notes || null,
    };
    const query = id
      ? supabase.from('subscriptions').update(payload).eq('id', id)
      : supabase.from('subscriptions').insert(payload);
    const { data, error } = await query.select().single();
    if (error) fail(error);
    return mapSubscription(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (error) fail(error);
  },

  async listAssignments(): Promise<SubscriptionAssignment[]> {
    const { data, error } = await supabase
      .from('subscription_assignments')
      .select('*, employee:employees(full_name, preferential_name, email, department_name, status)')
      .order('assigned_at', { ascending: false });
    if (error) fail(error);
    return (data || []).map((row: any) => {
      const emp = Array.isArray(row.employee) ? row.employee[0] : row.employee;
      return {
        id: row.id,
        subscription_id: row.subscription_id,
        employee_id: row.employee_id,
        employee_name: emp?.preferential_name || emp?.full_name || '—',
        employee_email: emp?.email || '',
        employee_department: emp?.department_name || null,
        employee_status: emp?.status || null,
        assigned_at: row.assigned_at,
        notes: row.notes,
      };
    });
  },

  async assign(subscriptionId: string, employeeId: string): Promise<void> {
    const { error } = await supabase
      .from('subscription_assignments')
      .insert({ subscription_id: subscriptionId, employee_id: employeeId });
    if (error) {
      if (error.code === '23505') throw new Error('Esse funcionário já tem essa licença.');
      fail(error);
    }
  },

  async unassign(assignmentId: string): Promise<void> {
    const { error } = await supabase.from('subscription_assignments').delete().eq('id', assignmentId);
    if (error) fail(error);
  },
};

// ---------- Regras de cálculo ----------

export const PERIODICITY_LABEL: Record<SubscriptionPeriodicity, string> = {
  mensal: 'Mensal',
  anual: 'Anual',
  anual_pago_mensalmente: 'Anual pago mensalmente',
};

/** Custo mensal equivalente de uma assinatura */
export function monthlyCost(s: Subscription): number {
  return s.periodicity === 'anual' ? s.amount / 12 : s.amount;
}

/** Valor que a assinatura cobra num mês (YYYY-MM-01). Anuais só cobram no mês da renovação. */
export function costInMonth(s: Subscription, month: string): number {
  if (s.status !== 'ativa') return 0;
  if (s.periodicity !== 'anual') return s.amount;
  return s.renewal_date && s.renewal_date.slice(5, 7) === month.slice(5, 7) ? s.amount : 0;
}

/** Data de vencimento da assinatura dentro do mês (dia de vencimento > dia da renovação > dia 10) */
export function dueDateInMonth(s: Subscription, month: string): string {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const preferred = s.billing_day || (s.renewal_date ? Number(s.renewal_date.slice(8, 10)) : 10);
  return `${month.slice(0, 8)}${String(Math.min(preferred, lastDay)).padStart(2, '0')}`;
}

/** Soma N meses a um mês (YYYY-MM-01) */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export function currentMonth(): string {
  return `${todayISO().slice(0, 7)}-01`;
}

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

export const formatMonth = (iso: string) => {
  const s = new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
