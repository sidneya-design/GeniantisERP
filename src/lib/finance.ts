// Cálculo único dos gastos do mês — usado pelo Financeiro, pelo Excel e pela Visão Geral.
import { supabase } from './supabase';
import { Subscription } from '../types/subscription';
import { costInMonth, dueDateInMonth, PERIODICITY_LABEL } from '../services/subscriptionService';

export type ExpenseCategory = 'licencas' | 'manutencoes' | 'dominios' | 'ativos';

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  licencas: 'Licenças e assinaturas',
  manutencoes: 'Manutenções',
  dominios: 'Domínios',
  ativos: 'Compras de ativos',
};

export const CATEGORY_ORDER: ExpenseCategory[] = ['licencas', 'manutencoes', 'dominios', 'ativos'];

/** Uma linha de gasto, no mesmo formato para todas as categorias */
export interface ExpenseItem {
  id: string;
  category: ExpenseCategory;
  title: string;      // serviço, patrimônio, domínio...
  detail: string;     // fornecedor, problema, registradora...
  date: string;       // data em que o gasto conta (YYYY-MM-DD)
  tag: string;        // periodicidade, situação, "Pago"/"Previsto"...
  amount: number;
}

interface FinanceRaw {
  subscriptions: Subscription[];
  maintenances: any[];
  domains: any[];
  domain_renewals: any[];
  asset_purchases: any[];
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const inMonth = (date: string | null | undefined, month: string) => !!date && date.slice(0, 7) === month.slice(0, 7);

export async function loadFinanceData(): Promise<FinanceRaw> {
  const { data, error } = await supabase.rpc('get_finance_data');
  if (error) {
    if (/get_finance_data|function/i.test(error.message)) {
      throw new Error('Rode as migrations do Financeiro (20261112000003 e 20261112000006) no Supabase.');
    }
    throw new Error(error.message);
  }
  const d = (data || {}) as any;
  return {
    subscriptions: (d.subscriptions || []).map((s: any) => ({ ...s, amount: num(s.amount), total_licenses: num(s.total_licenses) })),
    maintenances: d.maintenances || [],
    domains: d.domains || [],
    domain_renewals: d.domain_renewals || [],
    asset_purchases: d.asset_purchases || [],
  };
}

/** Todos os gastos que contam num mês (YYYY-MM-01) */
export function expensesInMonth(raw: FinanceRaw, month: string): ExpenseItem[] {
  const items: ExpenseItem[] = [];

  for (const s of raw.subscriptions) {
    const amount = costInMonth(s, month);
    if (amount > 0) {
      items.push({
        id: `lic-${s.id}`, category: 'licencas', title: s.service_name, detail: s.provider || '',
        date: dueDateInMonth(s, month), tag: PERIODICITY_LABEL[s.periodicity], amount,
      });
    }
  }

  for (const m of raw.maintenances) {
    const date = m.status === 'concluida' && m.completed_at ? m.completed_at : m.opened_at;
    if (inMonth(date, month)) {
      items.push({
        id: `man-${m.id}`, category: 'manutencoes', title: `${m.patrimony || '—'} · ${m.equipment || ''}`.trim(),
        detail: [m.issue, m.provider].filter(Boolean).join(' — '), date,
        tag: m.status === 'concluida' ? 'Concluída' : 'Em andamento', amount: num(m.cost),
      });
    }
  }

  // Domínios: renovação paga no mês + previsto para quem vence no mês e ainda não renovou
  for (const r of raw.domain_renewals) {
    if (inMonth(r.renewed_at, month)) {
      items.push({
        id: `ren-${r.id}`, category: 'dominios', title: r.domain, detail: r.registrar || '',
        date: r.renewed_at, tag: 'Renovado', amount: num(r.cost),
      });
    }
  }
  for (const d of raw.domains) {
    if (inMonth(d.expiration_date, month)) {
      items.push({
        id: `dom-${d.id}`, category: 'dominios', title: d.domain, detail: d.registrar || '',
        date: d.expiration_date, tag: d.auto_renew ? 'Previsto (automática)' : 'Previsto', amount: num(d.renewal_cost),
      });
    }
  }

  for (const a of raw.asset_purchases) {
    if (inMonth(a.acquisition_date, month)) {
      items.push({
        id: `atv-${a.id}`, category: 'ativos', title: `${a.patrimony} · ${a.equipment || ''}`.trim(),
        detail: a.category || '', date: a.acquisition_date, tag: 'Aquisição', amount: num(a.purchase_cost),
      });
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export function totalsByCategory(items: ExpenseItem[]): Record<ExpenseCategory, number> {
  const t = { licencas: 0, manutencoes: 0, dominios: 0, ativos: 0 } as Record<ExpenseCategory, number>;
  for (const i of items) t[i.category] += i.amount;
  return t;
}
