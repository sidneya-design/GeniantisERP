// Os perfis antigos permanecem no tipo enquanto a migração do banco é aplicada
// em todos os ambientes. O frontend novo utiliza principalmente admin, adm, ti e rh.
export type UserRole = 'admin' | 'adm' | 'ti' | 'rh' | 'financeiro' | 'consulta';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  name: string;
  address?: string;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  created_at: string;
  link?: string;
}

// Matriz de Acesso RBAC
export type ModuleKey = 
  | 'overview'
  | 'employees'
  | 'assets'
  | 'movements'
  | 'maintenance'
  | 'subscriptions'
  | 'domains'
  | 'birthdays'
  | 'reports'
  | 'finance'
  | 'logs'
  | 'settings';

export interface ModulePermission {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
