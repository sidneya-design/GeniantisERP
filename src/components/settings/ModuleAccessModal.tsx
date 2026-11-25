import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { ModuleKey, UserProfile } from '../../types';
import { MODULE_CATALOG, levelLabel, ModuleOverrides, PermissionLevel, roleDefaultLevel } from '../../lib/permissions';
import { ModulePermissionService } from '../../services/modulePermissionService';
import { ROLE_INFO } from '../../services/userService';

const LEVELS: PermissionLevel[] = [0, 1, 2, 3];

const LEVEL_STYLE: Record<PermissionLevel, string> = {
  0: 'bg-slate-600 text-white',
  1: 'bg-sky-600 text-white',
  2: 'bg-blue-600 text-white',
  3: 'bg-indigo-700 text-white',
};

/** Blocos de módulos de um usuário: o perfil traz o padrão e o Admin ajusta cada módulo */
export const ModuleAccessModal: React.FC<{
  user: UserProfile;
  overrides: ModuleOverrides;
  onClose: () => void;
  onSaved: (overrides: ModuleOverrides) => void;
}> = ({ user, overrides, onClose, onSaved }) => {
  const defaults = useMemo(() => {
    const out = {} as Record<ModuleKey, PermissionLevel>;
    for (const m of MODULE_CATALOG) out[m.key] = roleDefaultLevel(user.role, m.key);
    return out;
  }, [user.role]);

  const [levels, setLevels] = useState<Record<ModuleKey, PermissionLevel>>(() => {
    const out = { ...defaults };
    for (const m of MODULE_CATALOG) if (overrides[m.key] !== undefined) out[m.key] = overrides[m.key]!;
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const changed = MODULE_CATALOG.filter((m) => levels[m.key] !== defaults[m.key]).length;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await ModulePermissionService.save(user.id, user.role, levels);
      const next: ModuleOverrides = {};
      for (const m of MODULE_CATALOG) if (levels[m.key] !== defaults[m.key]) next[m.key] = levels[m.key];
      onSaved(next);
    } catch (e: any) {
      setError(e?.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-blue-600" /> Módulos de {user.full_name || user.email}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Perfil <span className={`px-1.5 py-0.5 rounded border font-bold text-[10px] ${ROLE_INFO[user.role]?.color || ''}`}>{ROLE_INFO[user.role]?.label || user.role}</span>
              {' '}define o padrão. Ajuste só o que for diferente para esta pessoa.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-xs">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULE_CATALOG.map((m) => {
              const level = levels[m.key];
              const isDefault = level === defaults[m.key];
              return (
                <div key={m.key} className={`rounded-xl border p-3.5 space-y-2.5 ${isDefault ? 'border-slate-200' : 'border-amber-300 bg-amber-50/40'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800">{m.label}</span>
                      <span className="block text-[11px] text-slate-500">{m.description}</span>
                    </div>
                    {isDefault ? (
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400">padrão do perfil</span>
                    ) : (
                      <button type="button" onClick={() => setLevels({ ...levels, [m.key]: defaults[m.key] })} className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:text-amber-900" title={`Voltar para: ${levelLabel(m.key, defaults[m.key])}`}>
                        <RotateCcw className="w-3 h-3" /> alterado
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 rounded-lg border border-slate-200 overflow-hidden text-[11px] font-semibold">
                    {LEVELS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLevels({ ...levels, [m.key]: l })}
                        className={`px-1 py-1.5 transition-colors ${level === l ? LEVEL_STYLE[l] : 'bg-white text-slate-600 hover:bg-slate-50'} ${l > 0 ? 'border-l border-slate-200' : ''}`}
                      >
                        {levelLabel(m.key, l)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            "Excluir" inclui ver e editar. Usuários, Logs e Configurações são sempre só do Admin. Dados pessoais dos funcionários (CPF, endereço, contato de emergência) seguem restritos ao perfil RH e ADM.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-4">
          <span className="text-xs text-slate-500">{changed === 0 ? 'Segue exatamente o perfil.' : `${changed} módulo(s) diferente(s) do perfil.`}</span>
          <div className="flex gap-2">
            {changed > 0 && <button type="button" onClick={() => setLevels({ ...defaults })} className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Voltar tudo ao perfil</button>}
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold">Cancelar</button>
            <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold">{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
