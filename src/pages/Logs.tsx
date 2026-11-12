import React, { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, AlertCircle, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { AuditService, AuditLog, AuditFilters, ENTITY_LABEL, ACTION_LABEL, FIELD_LABEL } from '../services/auditService';

const inputClass =
  'px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600';

const IGNORED_FIELDS = new Set(['id', 'created_at', 'updated_at', 'passwordHash']);

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR');
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const fieldName = (k: string) => FIELD_LABEL[k] || k;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' });

const Details: React.FC<{ log: AuditLog }> = ({ log }) => {
  const d = log.details || {};
  if (d.alteracoes) {
    const entries = Object.entries(d.alteracoes as Record<string, { de: unknown; para: unknown }>);
    return (
      <table className="text-xs w-full">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="py-1 pr-4 font-semibold">Campo</th>
            <th className="py-1 pr-4 font-semibold">Antes</th>
            <th className="py-1 font-semibold">Depois</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="align-top">
              <td className="py-1 pr-4 font-semibold text-slate-700">{fieldName(k)}</td>
              <td className="py-1 pr-4 text-rose-700 line-through decoration-rose-300 break-all">{formatValue(v?.de)}</td>
              <td className="py-1 text-emerald-700 break-all">{formatValue(v?.para)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const record = (d.registro || d) as Record<string, unknown>;
  const entries = Object.entries(record).filter(([k, v]) => !IGNORED_FIELDS.has(k) && v !== null && v !== '');
  if (entries.length === 0) return <span className="text-xs text-slate-400">Sem detalhes.</span>;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="font-semibold text-slate-700 shrink-0">{fieldName(k)}:</dt>
          <dd className="text-slate-600 break-all">{formatValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
};

export const Logs: React.FC = () => {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authors, setAuthors] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async (f: AuditFilters, p = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await AuditService.list(f, p);
      setLogs((prev) => (p === 0 ? res.rows : [...prev, ...res.rows]));
      setHasMore(res.hasMore);
      setPage(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    AuditService.authors().then(setAuthors).catch(() => setAuthors([]));
  }, []);

  useEffect(() => {
    load(filters, 0);
  }, [filters]);

  // Busca com pequena espera enquanto digita
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === (search || undefined) ? f : { ...f, search: search || undefined }));
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const setFilter = (key: keyof AuditFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value || undefined }));

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-blue-600" /> Logs de Atividade
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Tudo o que cada usuário fez no ERP: acessos, inclusões, alterações e exclusões. O registro não pode ser editado nem apagado.
          </p>
        </div>
        <button
          onClick={() => load(filters, 0)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className={`${inputClass} w-full pl-9`} />
        </div>
        <select value={filters.userEmail || ''} onChange={(e) => setFilter('userEmail', e.target.value)} className={inputClass}>
          <option value="">Todos os usuários</option>
          {authors.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={filters.entity || ''} onChange={(e) => setFilter('entity', e.target.value)} className={inputClass}>
          <option value="">Todos os módulos</option>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filters.action || ''} onChange={(e) => setFilter('action', e.target.value)} className={inputClass}>
          <option value="">Todas as ações</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <input type="date" value={filters.from || ''} onChange={(e) => setFilter('from', e.target.value)} className={`${inputClass} w-full`} title="De" />
          <input type="date" value={filters.to || ''} onChange={(e) => setFilter('to', e.target.value)} className={`${inputClass} w-full`} title="Até" />
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setSearch('');
              setFilters({});
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 lg:col-span-6 justify-self-start"
          >
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="w-8" />
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Data e hora</th>
                <th className="text-left px-4 py-3 font-semibold">Usuário</th>
                <th className="text-left px-4 py-3 font-semibold">Ação</th>
                <th className="text-left px-4 py-3 font-semibold">Módulo</th>
                <th className="text-left px-4 py-3 font-semibold">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const open = expanded.has(log.id);
                const action = ACTION_LABEL[log.action] || { label: log.action, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
                const changed = log.details?.alteracoes ? Object.keys(log.details.alteracoes).length : 0;
                return (
                  <React.Fragment key={log.id}>
                    <tr onClick={() => toggle(log.id)} className="cursor-pointer hover:bg-slate-50/80">
                      <td className="pl-3 text-slate-400">
                        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{log.user_name || log.user_email || '—'}</div>
                        {log.user_name && <div className="text-xs text-slate-500">{log.user_email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${action.cls}`}>{action.label}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{ENTITY_LABEL[log.entity] || log.entity}</td>
                      <td className="px-4 py-3">
                        <span className="text-slate-800">{log.summary || '—'}</span>
                        {changed > 0 && <span className="ml-2 text-xs text-slate-400">({changed} campo{changed > 1 ? 's' : ''})</span>}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50/60">
                        <td />
                        <td colSpan={5} className="px-4 py-3">
                          <Details log={log} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!loading && logs.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Nenhuma atividade {hasFilters ? 'com esses filtros' : 'registrada ainda'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="p-4 border-t border-slate-100 text-center">
            <button
              onClick={() => load(filters, page + 1)}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Carregando...' : 'Carregar mais'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
