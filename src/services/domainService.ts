import { supabase } from '../lib/supabase';
import { todayISO } from './subscriptionService';

export type DomainCriticality = 'baixa' | 'media' | 'alta';
export type DomainStatus = 'ativo' | 'cancelado';

export interface Domain {
  id: string;
  domain: string;
  is_subdomain: boolean;
  parent_domain: string | null;
  registrar: string | null;
  organization: string | null;
  admin_email: string | null;
  responsible: string | null;
  backup_responsible: string | null;
  expiration_date: string | null;
  auto_renew: boolean;
  renewal_cost: number | null;
  criticality: DomainCriticality;
  status: DomainStatus;
  services: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type DomainInput = Omit<Domain, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export interface DomainRenewal {
  id: string;
  domain_id: string;
  renewed_at: string;
  previous_expiration: string | null;
  new_expiration: string;
  cost: number | null;
  notes: string | null;
  created_at: string;
}

export type ExpiryLevel = 'ok' | 'soon' | 'urgent' | 'expired' | 'none' | 'cancelled';

function fail(error: { message: string; code?: string } | null): never {
  if (error?.code === '42P01' || /does not exist|schema cache/i.test(error?.message || '')) {
    throw new Error('As tabelas de domínios ainda não existem no Supabase. Rode a migration 20261112000005_domains.sql.');
  }
  throw new Error(error?.message || 'Erro desconhecido.');
}

const mapDomain = (row: any): Domain => ({
  ...row,
  services: row.services || [],
  renewal_cost: row.renewal_cost === null || row.renewal_cost === undefined ? null : Number(row.renewal_cost),
});

export const DomainService = {
  async list(): Promise<Domain[]> {
    const { data, error } = await supabase.from('domains').select('*').order('domain');
    if (error) fail(error);
    return (data || []).map(mapDomain);
  },

  async save(input: DomainInput): Promise<Domain> {
    const { id, ...fields } = input;
    const payload = {
      ...fields,
      domain: fields.domain.trim().toLowerCase(),
      parent_domain: fields.is_subdomain ? fields.parent_domain?.trim().toLowerCase() || null : null,
      registrar: fields.registrar || null,
      organization: fields.organization || null,
      admin_email: fields.admin_email || null,
      responsible: fields.responsible || null,
      backup_responsible: fields.backup_responsible || null,
      expiration_date: fields.expiration_date || null,
      renewal_cost: fields.renewal_cost === null || (fields.renewal_cost as any) === '' ? null : Number(fields.renewal_cost),
      notes: fields.notes || null,
      services: fields.services.map((s) => s.trim()).filter(Boolean),
    };
    const query = id ? supabase.from('domains').update(payload).eq('id', id) : supabase.from('domains').insert(payload);
    const { data, error } = await query.select().single();
    if (error) {
      if (error.code === '23505') throw new Error('Esse domínio já está cadastrado.');
      fail(error);
    }
    return mapDomain(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('domains').delete().eq('id', id);
    if (error) fail(error);
  },

  async renewals(domainId: string): Promise<DomainRenewal[]> {
    const { data, error } = await supabase
      .from('domain_renewals')
      .select('*')
      .eq('domain_id', domainId)
      .order('renewed_at', { ascending: false });
    if (error) fail(error);
    return (data || []).map((r: any) => ({ ...r, cost: r.cost === null ? null : Number(r.cost) }));
  },

  async renew(domainId: string, input: { new_expiration: string; renewed_at: string; cost: number | null; notes: string }) {
    const { error } = await supabase.rpc('renew_domain', {
      p_domain_id: domainId,
      p_new_expiration: input.new_expiration,
      p_renewed_at: input.renewed_at,
      p_cost: input.cost,
      p_notes: input.notes || null,
    });
    if (error) fail(error);
  },
};

export function daysToExpire(d: Domain): number | null {
  if (!d.expiration_date) return null;
  const diff = new Date(`${d.expiration_date}T12:00:00`).getTime() - new Date(`${todayISO()}T12:00:00`).getTime();
  return Math.round(diff / 86400000);
}

export function expiryLevel(d: Domain): ExpiryLevel {
  if (d.status === 'cancelado') return 'cancelled';
  const days = daysToExpire(d);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'ok';
}

/** Data + 1 ano (sugestão de novo vencimento ao renovar) */
export function plusOneYear(iso: string | null): string {
  const base = iso && iso >= todayISO() ? iso : todayISO();
  const [y, m, d] = base.split('-').map(Number);
  const next = new Date(y + 1, m - 1, d);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}
