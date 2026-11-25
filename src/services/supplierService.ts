import { supabase } from '../lib/supabase';
import { Supplier, SupplierContract, SupplierContractInput, SupplierInput } from '../types/supplier';

const BUCKET = 'supplier-contracts';

function fail(error: { message: string; code?: string } | null): never {
  if (error?.code === '42P01' || /does not exist|schema cache/i.test(error?.message || '')) {
    throw new Error('As tabelas de fornecedores ainda não existem no Supabase. Rode a migration 20261116000022_suppliers_contracts.sql.');
  }
  if (error?.code === '23505') throw new Error('Já existe um fornecedor com esse nome.');
  if (error?.code === '23503') throw new Error('Este fornecedor tem contratos cadastrados. Exclua os contratos ou marque o fornecedor como inativo.');
  throw new Error(error?.message || 'Erro desconhecido.');
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const orNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

const mapSupplier = (row: any): Supplier => ({ ...row, contacts: Array.isArray(row.contacts) ? row.contacts : [] });
const mapContract = (row: any): SupplierContract => ({ ...row, monthly_amount: num(row.monthly_amount) });

/** Dias até a data (negativo = já passou) */
export function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

/** Último dia para pedir o cancelamento sem renovar (fim do contrato − aviso prévio) */
export function noticeDeadline(contract: Pick<SupplierContract, 'end_date' | 'notice_days'>): string | null {
  if (!contract.end_date || !contract.notice_days) return null;
  const d = new Date(`${contract.end_date}T12:00:00`);
  d.setDate(d.getDate() - contract.notice_days);
  return d.toISOString().slice(0, 10);
}

export const SupplierService = {
  async list(): Promise<Supplier[]> {
    const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
    if (error) fail(error);
    return (data || []).map(mapSupplier);
  },

  async save(input: SupplierInput): Promise<Supplier> {
    const { id, ...fields } = input;
    const payload = {
      name: fields.name.trim(),
      legal_name: orNull(fields.legal_name),
      cnpj: orNull(fields.cnpj),
      category: fields.category,
      status: fields.status,
      phone: orNull(fields.phone),
      email: orNull(fields.email),
      website: orNull(fields.website),
      support_phone: orNull(fields.support_phone),
      support_email: orNull(fields.support_email),
      support_url: orNull(fields.support_url),
      customer_number: orNull(fields.customer_number),
      contacts: (fields.contacts || []).filter((c) => c.name?.trim() || c.phone?.trim() || c.email?.trim()),
      address: orNull(fields.address),
      notes: orNull(fields.notes),
    };
    const query = id
      ? supabase.from('suppliers').update(payload).eq('id', id)
      : supabase.from('suppliers').insert(payload);
    const { data, error } = await query.select().single();
    if (error) fail(error);
    return mapSupplier(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) fail(error);
  },

  async listContracts(): Promise<SupplierContract[]> {
    const { data, error } = await supabase.from('supplier_contracts').select('*').order('end_date', { ascending: true, nullsFirst: false });
    if (error) fail(error);
    return (data || []).map(mapContract);
  },

  async saveContract(input: SupplierContractInput, file?: File | null): Promise<SupplierContract> {
    const { id, ...fields } = input;
    let filePath = fields.file_path;
    let fileName = fields.file_name;
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${fields.supplier_id}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw new Error(`Não foi possível enviar o PDF: ${upErr.message}`);
      filePath = path;
      fileName = file.name;
    }
    const payload = {
      supplier_id: fields.supplier_id,
      name: fields.name.trim(),
      contract_number: orNull(fields.contract_number),
      start_date: fields.start_date || null,
      end_date: fields.end_date || null,
      monthly_amount: num(fields.monthly_amount),
      billing_day: fields.billing_day || null,
      auto_renew: fields.auto_renew,
      notice_days: fields.notice_days === null || fields.notice_days === undefined || (fields.notice_days as unknown) === '' ? null : Number(fields.notice_days),
      readjustment: orNull(fields.readjustment),
      penalty: orNull(fields.penalty),
      status: fields.status,
      file_path: filePath || null,
      file_name: fileName || null,
      notes: orNull(fields.notes),
    };
    const query = id
      ? supabase.from('supplier_contracts').update(payload).eq('id', id)
      : supabase.from('supplier_contracts').insert(payload);
    const { data, error } = await query.select().single();
    if (error) fail(error);
    return mapContract(data);
  },

  async removeContract(id: string): Promise<void> {
    const { error } = await supabase.from('supplier_contracts').delete().eq('id', id);
    if (error) fail(error);
  },

  async getContractUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw new Error(error?.message || 'Não foi possível abrir o PDF.');
    return data.signedUrl;
  },
};
