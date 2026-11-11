import { UserRole, ModuleKey, ModulePermission } from '../types';

export const ROLE_PERMISSIONS: Record<UserRole, Record<ModuleKey, ModulePermission>> = {
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
    settings: { canView: true, canEdit: true, canDelete: true },
  },
  ti: {
    overview: { canView: true, canEdit: false, canDelete: false },
    employees: { canView: true, canEdit: true, canDelete: false }, // visualiza ficha e vincula ativos/licenças
    assets: { canView: true, canEdit: true, canDelete: false },
    movements: { canView: true, canEdit: true, canDelete: false },
    maintenance: { canView: true, canEdit: true, canDelete: false },
    subscriptions: { canView: true, canEdit: true, canDelete: false }, // operacional/atribuição
    domains: { canView: true, canEdit: true, canDelete: false },
    birthdays: { canView: true, canEdit: false, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
    settings: { canView: false, canEdit: false, canDelete: false },
  },
  rh: {
    overview: { canView: true, canEdit: false, canDelete: false },
    employees: { canView: true, canEdit: true, canDelete: false },
    assets: { canView: true, canEdit: false, canDelete: false },
    movements: { canView: true, canEdit: false, canDelete: false },
    maintenance: { canView: false, canEdit: false, canDelete: false },
    subscriptions: { canView: true, canEdit: false, canDelete: false },
    domains: { canView: false, canEdit: false, canDelete: false },
    birthdays: { canView: true, canEdit: true, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
    settings: { canView: false, canEdit: false, canDelete: false },
  },
  financeiro: {
    overview: { canView: true, canEdit: false, canDelete: false },
    employees: { canView: true, canEdit: false, canDelete: false },
    assets: { canView: true, canEdit: false, canDelete: false },
    movements: { canView: false, canEdit: false, canDelete: false },
    maintenance: { canView: false, canEdit: false, canDelete: false },
    subscriptions: { canView: true, canEdit: true, canDelete: false }, // controle financeiro e pagamentos
    domains: { canView: true, canEdit: false, canDelete: false },
    birthdays: { canView: false, canEdit: false, canDelete: false },
    reports: { canView: true, canEdit: false, canDelete: false },
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
    settings: { canView: false, canEdit: false, canDelete: false },
  },
};

export function canAccessModule(role: UserRole | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[module]?.canView ?? false;
}
