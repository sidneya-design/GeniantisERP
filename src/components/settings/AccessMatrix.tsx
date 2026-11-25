import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { MODULE_CATALOG, ModuleOverrides, PermissionLevel, levelLabel, roleDefaultLevel } from '../../lib/permissions';
import { ROLE_INFO, ROLE_ORDER } from '../../services/userService';

const CELL: Record<PermissionLevel, { text: string; style: string }> = {
  0: { text: '—', style: 'text-slate-300' },
  1: { text: 'Ver', style: 'bg-sky-50 text-sky-700' },
  2: { text: 'Editar', style: 'bg-blue-50 text-blue-700' },
  3: { text: 'Excluir', style: 'bg-indigo-50 text-indigo-700' },
};

/** Tabela pessoas × módulos com o acesso efetivo (perfil + ajustes) */
export const AccessMatrix: React.FC<{
  users: UserProfile[];
  overrides: Record<string, ModuleOverrides>;
  onEdit: (user: UserProfile) => void;
}> = ({ users, overrides, onEdit }) => {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'todos' | UserRole>('todos');
  const [onlyAdjusted, setOnlyAdjusted] = useState(false);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((u) => u.is_active && u.role !== 'admin')
      .filter((u) => role === 'todos' || u.role === role)
      .filter((u) => !onlyAdjusted || Object.keys(overrides[u.id] || {}).length > 0)
      .filter((u) => !term || [u.full_name, u.email].some((v) => v?.toLowerCase().includes(term)))
      .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
  }, [users, overrides, search, role, onlyAdjusted]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as any)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white md:w-48">
          <option value="todos">Todos os perfis</option>
          {ROLE_ORDER.filter((r) => r !== 'admin').map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={onlyAdjusted} onChange={(e) => setOnlyAdjusted(e.target.checked)} className="w-4 h-4 rounded" /> Só quem tem ajustes
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs min-w-full">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-3 font-semibold uppercase min-w-[180px]">Usuário</th>
              {MODULE_CATALOG.map((m) => (
                <th key={m.key} className="px-2 py-3 font-semibold text-center whitespace-nowrap" title={m.description}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/70 cursor-pointer" onClick={() => onEdit(u)} title="Clique para ajustar os módulos">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                  <span className="block font-semibold text-slate-800 truncate max-w-[200px]">{u.full_name || u.email}</span>
                  <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded border text-[10px] font-bold ${ROLE_INFO[u.role]?.color || ''}`}>{ROLE_INFO[u.role]?.label || u.role}</span>
                </td>
                {MODULE_CATALOG.map((m) => {
                  const own = overrides[u.id]?.[m.key];
                  const level = (own ?? roleDefaultLevel(u.role, m.key)) as PermissionLevel;
                  const adjusted = own !== undefined;
                  return (
                    <td key={m.key} className="px-1.5 py-2.5 text-center">
                      <span
                        className={`inline-block min-w-[52px] px-1.5 py-1 rounded-md font-semibold ${CELL[level].style} ${adjusted ? 'ring-2 ring-amber-400' : ''}`}
                        title={adjusted ? `Ajustado (padrão do perfil: ${level === 0 ? '—' : levelLabel(m.key, roleDefaultLevel(u.role, m.key))})` : 'Padrão do perfil'}
                      >
                        {level === 0 ? CELL[0].text : levelLabel(m.key, level)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={MODULE_CATALOG.length + 1} className="px-4 py-8 text-center text-sm text-slate-400">Nenhum usuário com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span><span className="inline-block w-3 h-3 rounded ring-2 ring-amber-400 align-middle mr-1" /> ajustado para a pessoa</span>
        <span>— sem acesso</span>
        <span>Administradores têm acesso total e não aparecem aqui.</span>
        <span>Clique numa linha para ajustar.</span>
      </div>
    </div>
  );
};
