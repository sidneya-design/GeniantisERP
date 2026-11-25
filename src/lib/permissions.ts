import { UserRole, ModuleKey, ModulePermission } from '../types';

export const ROLE_PERMISSIONS: Record<UserRole, Record<ModuleKey, ModulePermission>> = {
  // admin: Vê tudo
  admin: {
    overview: { canView: true, canEdit: true, canDelete: true },
    employees: { canView: true, canEdit: true, canDelete: true },
    assets: { canView: true, canEdit: true, canDelete: true },
    movements: { canView: true, canEdit: true, canDelete: true },
    maintenance: { canView: true, canEdit: true, canDelete: true },
    subscriptions: { canView: true, canEdit: true, canDelete: true },
    suppliers: { canView: true, canEdit: true, canDelete: true },
    domains: { canView: true, canEdit: true, canDelete: true },
    birthdays: { canView: true, canEdit: true, canDelete: true },
    banners: { canView: true, canEdit: true, canDelete: true },
    communications: { canView: true, canEdit: true, canDelete: true },
    documents: { canView: true, canEdit: true, canDelete: true },
    reports: { canView: true, canEdit: true, canDelete: true },
    timesheet: { canView: true, canEdit: true, canDelete: true },
    agenda: { canView: true, canEdit: true, canDelete: true },
    finance: { canView: true, canEdit: true, canDelete: true },
    logs: { canView: true, canEdit: false, canDelete: false },
    settings: { canView: true, canEdit: true, canDelete: true },
  },
  // ADM: Vê tudo menos Configurações; Ativos, Manutenções e Domínios só leitura
  adm: {
    overview: { canView: true, canEdit: true, canDelete: false },
    employees: { canView: true, canEdit: false, canDelete: false },
    assets: { canView: true, canEdit: false, canDelete: false },
    movements: { canView: true, canEdit: true, canDelete: false },
    maintenance: { canView: true, canEdit: false, canDelete: false },
    subscriptions: { canView: true, canEdit: true, canDelete: false },
    suppliers: { canView: true, canEdit: true, canDelete: false },
    domains: { canView: true, canEdit: false, canDelete: false },
    birthdays: { canView: true, canEdit: true, canDelete: false },
    banners: { canView: true, canEdit: true, canDelete: false },
    communications: { canView: true, canEdit: false, canDelete: false },
    documents: { canView: true, canEdit: true, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
    timesheet: { canView: true, canEdit: false, canDelete: false },
    agenda: { canView: true, canEdit: true, canDelete: false },
    finance: { canView: true, canEdit: false, canDelete: false },
    logs: { canView: false, canEdit: false, canDelete: false },
    settings: { canView: false, canEdit: false, canDelete: false },
  },
  // TI: Vê Visão Geral, Funcionários (sem dados pessoais), Ativos de TI, Entrega e Devoluções, Manutenções, Domínios e Renovações
  ti: {
    overview: { canView: true, canEdit: false, canDelete: false },
    employees: { canView: true, canEdit: true, canDelete: false },
    assets: { canView: true, canEdit: true, canDelete: false },
    movements: { canView: true, canEdit: true, canDelete: false },
    maintenance: { canView: true, canEdit: true, canDelete: false },
    subscriptions: { canView: false, canEdit: false, canDelete: false },
    suppliers: { canView: true, canEdit: true, canDelete: false },
    domains: { canView: true, canEdit: true, canDelete: false },
    birthdays: { canView: false, canEdit: false, canDelete: false },
    banners: { canView: true, canEdit: true, canDelete: false },
    communications: { canView: true, canEdit: false, canDelete: false },
    documents: { canView: true, canEdit: false, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
    timesheet: { canView: false, canEdit: false, canDelete: false },
    agenda: { canView: true, canEdit: true, canDelete: false },
    finance: { canView: false, canEdit: false, canDelete: false },
    logs: { canView: false, canEdit: false, canDelete: false },
    settings: { canView: false, canEdit: false, canDelete: false },
  },
  // RH: Vê Visão Geral, Funcionários, Aniversariantes e Financeiro (leitura)
  rh: {
    overview: { canView: true, canEdit: false, canDelete: false },
    employees: { canView: true, canEdit: true, canDelete: false },
    assets: { canView: false, canEdit: false, canDelete: false },
    movements: { canView: true, canEdit: false, canDelete: false },
    maintenance: { canView: false, canEdit: false, canDelete: false },
    subscriptions: { canView: false, canEdit: false, canDelete: false },
    suppliers: { canView: false, canEdit: false, canDelete: false },
    domains: { canView: false, canEdit: false, canDelete: false },
    birthdays: { canView: true, canEdit: true, canDelete: false },
    banners: { canView: true, canEdit: true, canDelete: false },
    communications: { canView: true, canEdit: true, canDelete: false },
    documents: { canView: true, canEdit: true, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
    timesheet: { canView: true, canEdit: true, canDelete: true },
    agenda: { canView: true, canEdit: true, canDelete: false },
    finance: { canView: true, canEdit: false, canDelete: false },
    logs: { canView: false, canEdit: false, canDelete: false },
    settings: { canView: false, canEdit: false, canDelete: false },
  },
  financeiro: {
    overview: { canView: true, canEdit: false, canDelete: false },
    employees: { canView: true, canEdit: false, canDelete: false },
    assets: { canView: true, canEdit: false, canDelete: false },
    movements: { canView: false, canEdit: false, canDelete: false },
    maintenance: { canView: false, canEdit: false, canDelete: false },
    subscriptions: { canView: true, canEdit: true, canDelete: false },
    suppliers: { canView: false, canEdit: false, canDelete: false },
    domains: { canView: true, canEdit: false, canDelete: false },
    birthdays: { canView: false, canEdit: false, canDelete: false },
    banners: { canView: false, canEdit: false, canDelete: false },
    communications: { canView: false, canEdit: false, canDelete: false },
    documents: { canView: false, canEdit: false, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
    timesheet: { canView: false, canEdit: false, canDelete: false },
    agenda: { canView: false, canEdit: false, canDelete: false },
    finance: { canView: false, canEdit: false, canDelete: false },
    logs: { canView: false, canEdit: false, canDelete: false },
    settings: { canView: false, canEdit: false, canDelete: false },
  },
  consulta: {
    overview: { canView: true, canEdit: false, canDelete: false },
    employees: { canView: true, canEdit: false, canDelete: false },
    assets: { canView: true, canEdit: false, canDelete: false },
    movements: { canView: true, canEdit: false, canDelete: false },
    maintenance: { canView: true, canEdit: false, canDelete: false },
    subscriptions: { canView: true, canEdit: false, canDelete: false },
    suppliers: { canView: false, canEdit: false, canDelete: false },
    domains: { canView: true, canEdit: false, canDelete: false },
    birthdays: { canView: true, canEdit: false, canDelete: false },
    banners: { canView: false, canEdit: false, canDelete: false },
    communications: { canView: false, canEdit: false, canDelete: false },
    documents: { canView: false, canEdit: false, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
    timesheet: { canView: false, canEdit: false, canDelete: false },
    agenda: { canView: false, canEdit: false, canDelete: false },
    finance: { canView: false, canEdit: false, canDelete: false },
    logs: { canView: false, canEdit: false, canDelete: false },
    settings: { canView: false, canEdit: false, canDelete: false },
  },
  // Funcionário: só o próprio ponto (Meu Ponto), nenhum módulo de gestão
  funcionario: {
    overview: { canView: false, canEdit: false, canDelete: false },
    employees: { canView: false, canEdit: false, canDelete: false },
    assets: { canView: false, canEdit: false, canDelete: false },
    movements: { canView: false, canEdit: false, canDelete: false },
    maintenance: { canView: false, canEdit: false, canDelete: false },
    subscriptions: { canView: false, canEdit: false, canDelete: false },
    suppliers: { canView: false, canEdit: false, canDelete: false },
    domains: { canView: false, canEdit: false, canDelete: false },
    birthdays: { canView: false, canEdit: false, canDelete: false },
    banners: { canView: false, canEdit: false, canDelete: false },
    communications: { canView: false, canEdit: false, canDelete: false },
    documents: { canView: false, canEdit: false, canDelete: false },
    reports: { canView: false, canEdit: false, canDelete: false },
    timesheet: { canView: false, canEdit: false, canDelete: false },
    agenda: { canView: false, canEdit: false, canDelete: false },
    finance: { canView: false, canEdit: false, canDelete: false },
    logs: { canView: false, canEdit: false, canDelete: false },
    settings: { canView: false, canEdit: false, canDelete: false },
  },
};

// Perfis que podem entrar no ERP. Os demais (financeiro, consulta) são barrados no login.
export const LOGIN_ROLES: UserRole[] = ['admin', 'adm', 'ti', 'rh', 'funcionario'];

export function canLogin(role: UserRole | undefined | null): boolean {
  return !!role && LOGIN_ROLES.includes(role);
}

export function canAccessModule(role: UserRole | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[module]?.canView ?? false;
}

export function getDefaultRouteForRole(role: UserRole | undefined): string {
  if (role === 'financeiro') return '/assinaturas';
  if (role === 'funcionario') return '/meu-ponto';
  return '/';
}

// ---------- Permissões por módulo (perfil + ajuste por pessoa) ----------

/** 0 sem acesso, 1 ver, 2 editar, 3 editar e excluir */
export type PermissionLevel = 0 | 1 | 2 | 3;

export const LEVEL_LABEL: Record<PermissionLevel, string> = {
  0: 'Sem acesso',
  1: 'Ver',
  2: 'Editar',
  3: 'Excluir',
};

/** Módulos que só o Admin acessa (não podem ser liberados por pessoa) */
export const ADMIN_ONLY_MODULES: ModuleKey[] = ['logs', 'settings'];

/** Módulos que aparecem nos blocos de liberação, na ordem do menu */
export const MODULE_CATALOG: { key: ModuleKey; label: string; description: string; levelLabels?: Partial<Record<PermissionLevel, string>> }[] = [
  { key: 'overview', label: 'Visão Geral', description: 'Painel inicial com resumos e alertas' },
  { key: 'employees', label: 'Funcionários', description: 'Cadastro de colaboradores' },
  { key: 'assets', label: 'Ativos de TI', description: 'Equipamentos e inventário' },
  { key: 'movements', label: 'Entregas & Devoluções', description: 'Movimentações e termos' },
  { key: 'maintenance', label: 'Manutenções', description: 'Ordens de manutenção dos ativos' },
  { key: 'subscriptions', label: 'Assinaturas & Licenças', description: 'Softwares e licenças por pessoa' },
  { key: 'suppliers', label: 'Fornecedores & Contratos', description: 'Empresas parceiras e contratos' },
  { key: 'finance', label: 'Financeiro', description: 'Gastos do mês e exportação' },
  { key: 'domains', label: 'Domínios & Renovações', description: 'Domínios e vencimentos' },
  { key: 'birthdays', label: 'Aniversariantes', description: 'Aniversários e envio de parabéns' },
  { key: 'banners', label: 'Banners & Avisos', description: 'Banners A4 para imprimir' },
  { key: 'communications', label: 'Comunicados', description: 'E-mails para os funcionários' },
  { key: 'documents', label: 'Termos de imagem', description: 'Licença de uso de imagem: assinaturas e texto' },
  {
    key: 'timesheet', label: 'Controle de Ponto',
    description: 'Ver: espelhos de todos · Aprovar: + pedidos (chefe de setor) · Gerenciar: + jornadas, feriados, marcações e banco (RH)',
    levelLabels: { 2: 'Aprovar', 3: 'Gerenciar' },
  },
  {
    key: 'agenda', label: 'Agenda',
    description: 'Ver: agenda pessoal e agendas abertas · Editar: cria agendas e edita as abertas · Excluir: cria agendas abertas e administra as compartilhadas',
  },
  { key: 'reports', label: 'Relatórios', description: 'Relatórios de cada módulo liberado' },
];

/** Nome do nível num módulo (alguns módulos têm nomes próprios) */
export function levelLabel(module: ModuleKey, level: PermissionLevel): string {
  return MODULE_CATALOG.find((m) => m.key === module)?.levelLabels?.[level] ?? LEVEL_LABEL[level];
}

export const levelToPerm = (level: number): ModulePermission => ({
  canView: level >= 1,
  canEdit: level >= 2,
  canDelete: level >= 3,
});

export const permToLevel = (p: ModulePermission | undefined): PermissionLevel =>
  p?.canDelete ? 3 : p?.canEdit ? 2 : p?.canView ? 1 : 0;

export const roleDefaultLevel = (role: UserRole, module: ModuleKey): PermissionLevel =>
  permToLevel(ROLE_PERMISSIONS[role]?.[module]);

export type ModuleOverrides = Partial<Record<ModuleKey, PermissionLevel>>;

/** Permissões efetivas: Admin tem tudo; demais usam o ajuste da pessoa ou o padrão do perfil */
export function effectivePermissions(role: UserRole, overrides: ModuleOverrides = {}): Record<ModuleKey, ModulePermission> {
  const base = ROLE_PERMISSIONS[role];
  const result = {} as Record<ModuleKey, ModulePermission>;
  for (const module of Object.keys(base) as ModuleKey[]) {
    if (role === 'admin') result[module] = base[module];
    else if (ADMIN_ONLY_MODULES.includes(module)) result[module] = levelToPerm(0);
    else if (overrides[module] !== undefined) result[module] = levelToPerm(overrides[module]!);
    else result[module] = base[module];
  }
  return result;
}
