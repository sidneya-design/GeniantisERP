import { supabase } from '../lib/supabase';

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string | null;
  details: any;
  created_at: string;
}

export interface AuditFilters {
  userEmail?: string;
  entity?: string;
  action?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  search?: string;
}

export const PAGE_SIZE = 100;

export const ENTITY_LABEL: Record<string, string> = {
  sessao: 'Acesso ao sistema',
  usuarios: 'Usuários',
  profiles: 'Perfis de usuário',
  employees: 'Funcionários',
  departments: 'Departamentos',
  units: 'Unidades',
  assets: 'Ativos de TI',
  asset_movements: 'Entregas & Devoluções',
  asset_movement_items: 'Itens de entrega',
  maintenance_orders: 'Manutenções',
  subscriptions: 'Assinaturas',
  subscription_assignments: 'Licenças atribuídas',
  domains: 'Domínios',
  domain_renewals: 'Renovações de domínio',
  aniversarios: 'E-mails de aniversário',
};

export const ACTION_LABEL: Record<string, { label: string; cls: string }> = {
  create: { label: 'Criou', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  update: { label: 'Alterou', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  delete: { label: 'Excluiu', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  login: { label: 'Entrou', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  logout: { label: 'Saiu', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  create_user: { label: 'Criou usuário', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  reset_password: { label: 'Redefiniu senha', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  password_change: { label: 'Trocou a senha', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  email_sent: { label: 'E-mail enviado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  email_failed: { label: 'Falha no e-mail', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

// Nomes legíveis dos campos mais comuns, para a lista de alterações
export const FIELD_LABEL: Record<string, string> = {
  full_name: 'Nome', preferential_name: 'Nome preferencial', email: 'E-mail', role: 'Perfil', is_active: 'Ativo',
  status: 'Situação', department_name: 'Departamento', unit_name: 'Unidade', role_title: 'Cargo', birth_date: 'Nascimento',
  admission_date: 'Admissão', termination_date: 'Desligamento', phone: 'Telefone', cpf: 'CPF',
  patrimony: 'Patrimônio', serial_number: 'Nº de série', category: 'Categoria', brand: 'Marca', model: 'Modelo',
  condition: 'Conservação', assigned_employee_id: 'Responsável', warranty_until: 'Garantia', purchase_cost: 'Custo de compra',
  issue: 'Problema', provider: 'Fornecedor', cost: 'Custo', forecast_date: 'Previsão', completed_at: 'Concluída em',
  service_name: 'Serviço', amount: 'Valor', periodicity: 'Periodicidade', total_licenses: 'Total de licenças',
  renewal_date: 'Renovação', billing_day: 'Dia de vencimento', auto_renew: 'Renovação automática', admin_email: 'Admin da conta',
  notes: 'Observações', employee_id: 'Funcionário',
  domain: 'Domínio', registrar: 'Registradora', expiration_date: 'Vencimento', renewal_cost: 'Custo da renovação',
  criticality: 'Criticidade', responsible: 'Responsável', backup_responsible: 'Substituto', services: 'Serviços',
  new_expiration: 'Novo vencimento', previous_expiration: 'Vencimento anterior', renewed_at: 'Renovado em',
};

function sanitize(text: string) {
  // Evita quebrar o filtro do PostgREST com vírgulas/parênteses
  return text.replace(/[,()*]/g, ' ').trim();
}

export const AuditService = {
  async list(filters: AuditFilters, page = 0): Promise<{ rows: AuditLog[]; hasMore: boolean }> {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE); // 1 a mais para saber se há próxima página

    if (filters.userEmail) query = query.eq('user_email', filters.userEmail);
    if (filters.entity) query = query.eq('entity', filters.entity);
    if (filters.action) query = query.eq('action', filters.action);
    if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00-03:00`);
    if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59.999-03:00`);
    if (filters.search) {
      const q = sanitize(filters.search);
      if (q) query = query.or(`summary.ilike.%${q}%,user_email.ilike.%${q}%,user_name.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      if (/user_email|summary|column/i.test(error.message)) {
        throw new Error('O log ainda não está configurado no Supabase. Rode a migration 20261112000002_audit_triggers.sql.');
      }
      throw new Error(error.message);
    }
    const rows = (data || []) as AuditLog[];
    return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
  },

  /** Autores distintos já registrados (para o filtro por usuário) */
  async authors(): Promise<string[]> {
    const { data } = await supabase.from('profiles').select('email').order('email');
    const emails = new Set<string>((data || []).map((p: any) => p.email).filter(Boolean));
    emails.add('sistema');
    return Array.from(emails);
  },
};
