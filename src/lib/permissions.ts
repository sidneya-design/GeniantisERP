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
    domains: { canView: true, canEdit: true, canDelete: true },
    birthdays: { canView: true, canEdit: true, canDelete: true },
    reports: { canView: true, canEdit: true, canDelete: true },
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
    domains: { canView: true, canEdit: false, canDelete: false },
    birthdays: { canView: true, canEdit: true, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
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
    domains: { canView: true, canEdit: true, canDelete: false },
    birthdays: { canView: false, canEdit: false, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
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
    domains: { canView: false, canEdit: false, canDelete: false },
    birthdays: { canView: true, canEdit: true, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
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
    domains: { canView: true, canEdit: false, canDelete: false },
    birthdays: { canView: false, canEdit: false, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
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
    domains: { canView: true, canEdit: false, canDelete: false },
    birthdays: { canView: true, canEdit: false, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
    finance: { canView: false, canEdit: false, canDelete: false },
    logs: { canView: false, canEdit: false, canDelete: false },
    settings: { canView: false, canEdit: false, canDelete: false },
  },
};

// Perfis que podem entrar no ERP. Os demais (financeiro, consulta) são barrados no login.
export const LOGIN_ROLES: UserRole[] = ['admin', 'adm', 'ti', 'rh'];

export function canLogin(role: UserRole | undefined | null): boolean {
  return !!role && LOGIN_ROLES.includes(role);
}

export function canAccessModule(role: UserRole | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[module]?.canView ?? false;
}

export function getDefaultRouteForRole(role: UserRole | undefined): string {
  if (role === 'financeiro') return '/assinaturas';
  return '/';
}
