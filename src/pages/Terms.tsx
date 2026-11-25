import React, { useEffect, useMemo, useState } from 'react';
import { Camera, FileSignature, FileText, Loader2, Mail, PenLine, Search, ShieldAlert, X } from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { ImageTermPanel } from '../components/employees/ImageTermPanel';
import { TermTemplatesEditor } from '../components/settings/TermTemplatesEditor';
import { usePermission } from '../lib/usePermission';
import { EmployeeService } from '../services/employeeService';
import { IMAGE_STATUS_CLS, IMAGE_STATUS_LABEL, ImageTerm, ImageTermService, ImageTermStatus } from '../services/imageTermService';
import { Employee } from '../types/employee';

const inputCls = 'text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600';

/** Termos: licença de uso de imagem de todos os funcionários + edição do texto do modelo */
export const Terms: React.FC = () => {
  const { canEdit } = usePermission('documents');
  const [tab, setTab] = useState<'imagem' | 'modelo'>('imagem');
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [terms, setTerms] = useState<Map<string, ImageTerm>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('todos');
  const [status, setStatus] = useState<'todos' | ImageTermStatus>('todos');
  const [includeTerminated, setIncludeTerminated] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);

  useEffect(() => {
    Promise.all([EmployeeService.getEmployees(), ImageTermService.listAll()])
      .then(([emps, map]) => { setEmployees(emps); setTerms(map); })
      .catch((e) => { setError(e?.message || 'Não foi possível carregar os funcionários.'); setEmployees([]); });
  }, []);

  const statusOf = (id: string): ImageTermStatus => terms.get(id)?.status || 'pendente';
  const updateTerm = (id: string, term: ImageTerm | null) => setTerms((m) => {
    const next = new Map(m);
    if (term) next.set(id, term); else next.delete(id);
    return next;
  });

  const base = useMemo(() => (employees || []).filter((e) => includeTerminated || e.status !== 'desligado'), [employees, includeTerminated]);
  const departments = useMemo(() => [...new Set(base.map((e) => e.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [base]);
  const scoped = base.filter((e) => dept === 'todos' || e.department === dept);
  const q = search.trim().toLowerCase();
  const rows = scoped
    .filter((e) => (status === 'todos' || statusOf(e.id) === status) && (!q || e.full_name.toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
  const count = (s: ImageTermStatus) => scoped.filter((e) => statusOf(e.id) === s).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileSignature className="w-6 h-6 text-blue-600" /> Termos de imagem</h2>
          <p className="text-slate-500 text-sm mt-1">Licença de uso de imagem dos funcionários: imprimir, registrar a assinatura e ajustar o texto do termo.</p>
        </div>
        {canEdit && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
            <button type="button" onClick={() => setTab('imagem')} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === 'imagem' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}><Camera className="w-4 h-4" /> Uso de imagem</button>
            <button type="button" onClick={() => setTab('modelo')} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === 'modelo' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}><PenLine className="w-4 h-4" /> Texto do termo</button>
          </div>
        )}
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2"><ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" /><span>{error}</span></div>}

      {tab === 'modelo' && canEdit && <TermTemplatesEditor only={['termo_imagem']} />}

      {tab === 'imagem' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ['autorizado', 'autorizaram', 'bg-emerald-50 border-emerald-100 text-emerald-700'],
              ['pendente', 'pendentes', 'bg-amber-50 border-amber-100 text-amber-700'],
              ['nao_autorizado', 'não autorizaram', 'bg-rose-50 border-rose-100 text-rose-700'],
            ] as const).map(([s, label, cls]) => (
              <button key={s} type="button" onClick={() => setStatus(status === s ? 'todos' : s)} className={`text-left p-3 rounded-xl border transition-shadow ${cls} ${status === s ? 'ring-2 ring-blue-500' : 'hover:shadow-xs'}`}>
                <span className="block text-xl font-bold">{employees ? count(s) : '—'}</span>
                <span className="text-xs">{label}</span>
              </button>
            ))}
            <div className="p-3 rounded-xl border bg-slate-50 border-slate-200 text-slate-700">
              <span className="block text-xl font-bold">{employees ? scoped.length : '—'}</span>
              <span className="text-xs">funcionários{dept !== 'todos' ? ` em ${dept}` : ''}</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar funcionário" className={`${inputCls} w-full pl-9`} />
            </div>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls}>
              <option value="todos">Todos os departamentos</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
              <option value="todos">Todas as situações</option>
              <option value="pendente">Pendente</option>
              <option value="autorizado">Autorizado</option>
              <option value="nao_autorizado">Não autorizado</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap"><input type="checkbox" checked={includeTerminated} onChange={(e) => setIncludeTerminated(e.target.checked)} className="w-4 h-4 rounded" /> Incluir desligados</label>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                  <tr><th className="px-6 py-3">Funcionário</th><th className="px-6 py-3">Departamento</th><th className="px-6 py-3">Uso de imagem</th><th className="px-6 py-3">Assinado em</th><th className="px-6 py-3">PDF</th><th className="px-6 py-3 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!employees ? (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…</td></tr>
                  ) : rows.map((e) => {
                    const t = terms.get(e.id);
                    const s = statusOf(e.id);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar src={e.photo_url} name={e.full_name} email={e.email} size={32} />
                            <div className="min-w-0"><span className="block font-semibold text-slate-800 truncate">{e.full_name}</span><span className="block text-xs text-slate-500 truncate">{e.email}</span></div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-xs">{e.department}</td>
                        <td className="px-6 py-3"><span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${IMAGE_STATUS_CLS[s]}`}>{IMAGE_STATUS_LABEL[s]}</span></td>
                        <td className="px-6 py-3 text-xs whitespace-nowrap">{t?.signed_at ? new Date(`${t.signed_at}T12:00:00Z`).toLocaleDateString('pt-BR') : '—'}</td>
                        <td className="px-6 py-3 text-xs">
                          {t?.file_path ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><FileText className="w-3.5 h-3.5" /> Anexado</span> : <span className="text-slate-400">—</span>}
                          {t?.emailed_at && <Mail className="w-3.5 h-3.5 inline ml-1.5 text-slate-400" aria-label="Cópia enviada por e-mail" />}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button type="button" onClick={() => setSelected(e)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-50">
                            <Camera className="w-4 h-4" /> {canEdit ? (s === 'pendente' ? 'Registrar' : 'Abrir') : 'Ver'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {employees && rows.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Nenhum funcionário com esses filtros.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-3">
                <Avatar src={selected.photo_url} name={selected.full_name} email={selected.email} size={44} />
                <div><h3 className="text-lg font-bold text-slate-800">{selected.full_name}</h3><span className="text-xs text-slate-500">{selected.department}{selected.role_title ? ` · ${selected.role_title}` : ''}</span></div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <ImageTermPanel employee={selected} canEdit={canEdit} onChange={updateTerm} />
          </div>
        </div>
      )}
    </div>
  );
};
