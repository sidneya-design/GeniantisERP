// Os perfis antigos permanecem no tipo enquanto a migração do banco é aplicada
// em todos os ambientes. O frontend novo utiliza principalmente admin, adm, ti e rh.
export type UserRole = 'admin' | 'adm' | 'ti' | 'rh' | 'financeiro' | 'consulta' | 'funcionario';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  avatar_url?: string | null;
  /** Receber avisos (agenda) por e-mail */
  notify_email?: boolean;
  employee_id?: string | null;
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
  | 'suppliers'
  | 'domains'
  | 'birthdays'
  | 'banners'
  | 'communications'
  | 'documents'
  | 'reports'
  | 'timesheet'
  | 'agenda'
  | 'finance'
  | 'logs'
  | 'settings';

export interface ModulePermission {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
