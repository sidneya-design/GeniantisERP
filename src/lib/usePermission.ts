import { useAuth } from '../contexts/AuthContext';
import { ModuleKey, ModulePermission } from '../types';
import { ROLE_PERMISSIONS } from './permissions';

const NONE: ModulePermission = { canView: false, canEdit: false, canDelete: false };

/** Permissões do usuário logado em um módulo (para esconder botões de quem só pode ver) */
export function usePermission(module: ModuleKey): ModulePermission {
  const { profile } = useAuth();
  if (!profile) return NONE;
  return ROLE_PERMISSIONS[profile.role]?.[module] ?? NONE;
}
