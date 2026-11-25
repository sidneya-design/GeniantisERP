import { useAuth } from '../contexts/AuthContext';
import { ModuleKey, ModulePermission } from '../types';

const NONE: ModulePermission = { canView: false, canEdit: false, canDelete: false };

/** Permissões da pessoa logada em um módulo (perfil + ajustes do Admin) */
export function usePermission(module: ModuleKey): ModulePermission {
  const { permissions } = useAuth();
  return permissions?.[module] ?? NONE;
}
