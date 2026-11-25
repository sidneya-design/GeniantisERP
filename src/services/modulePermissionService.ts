import { supabase } from '../lib/supabase';
import { ModuleKey, UserRole } from '../types';
import { ADMIN_ONLY_MODULES, ModuleOverrides, PermissionLevel, roleDefaultLevel } from '../lib/permissions';

const missingTable = (msg: string) => /user_module_permissions/.test(msg) && /exist|schema cache/i.test(msg);

export const ModulePermissionService = {
  /** Ajustes de uma pessoa (vazio se a migration ainda não foi rodada) */
  async forUser(userId: string): Promise<ModuleOverrides> {
    const { data, error } = await supabase.from('user_module_permissions').select('module, level').eq('user_id', userId);
    if (error) return {};
    const out: ModuleOverrides = {};
    for (const row of data || []) out[row.module as ModuleKey] = row.level as PermissionLevel;
    return out;
  },

  /** Ajustes de todos os usuários (só o Admin consegue ler) */
  async all(): Promise<Record<string, ModuleOverrides>> {
    const { data, error } = await supabase.from('user_module_permissions').select('user_id, module, level');
    if (error) return {};
    const out: Record<string, ModuleOverrides> = {};
    for (const row of data || []) {
      out[row.user_id] = { ...(out[row.user_id] || {}), [row.module]: row.level };
    }
    return out;
  },

  /** Grava os níveis escolhidos: o que for igual ao padrão do perfil vira "segue o perfil" */
  async save(userId: string, role: UserRole, levels: Partial<Record<ModuleKey, PermissionLevel>>): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const upserts: { user_id: string; module: string; level: number; updated_by: string | null; updated_at: string }[] = [];
    const resets: string[] = [];
    for (const [module, level] of Object.entries(levels) as [ModuleKey, PermissionLevel][]) {
      if (ADMIN_ONLY_MODULES.includes(module)) continue;
      if (level === roleDefaultLevel(role, module)) resets.push(module);
      else upserts.push({ user_id: userId, module, level, updated_by: auth.user?.id || null, updated_at: new Date().toISOString() });
    }
    if (resets.length) {
      const { error } = await supabase.from('user_module_permissions').delete().eq('user_id', userId).in('module', resets);
      if (error) throw new Error(missingTable(error.message) ? 'Rode a migration 20261116000027_module_permissions.sql no Supabase.' : error.message);
    }
    if (upserts.length) {
      const { error } = await supabase.from('user_module_permissions').upsert(upserts, { onConflict: 'user_id,module' });
      if (error) throw new Error(missingTable(error.message) ? 'Rode a migration 20261116000027_module_permissions.sql no Supabase.' : error.message);
    }
  },
};
