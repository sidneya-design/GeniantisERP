import React, { useEffect, useState } from 'react';
import {
  CreditCard, Plus, Users, AlertCircle, CheckCircle2, X, Pencil, Trash2, RefreshCw, UserPlus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_PERMISSIONS } from '../lib/permissions';
import { EmployeeService } from '../services/employeeService';
import { Employee } from '../types/employee';
import { Subscription, SubscriptionAssignment, SubscriptionInput, SubscriptionStatus } from '../types/subscription';
import {
  SubscriptionService, PERIODICITY_LABEL, monthlyCost, todayISO, brl, formatDate,
} from '../services/subscriptionService';

type Feedback = { type: 'success' | 'error'; text: string } | null;

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white';
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-1';

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  ativa: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  suspensa: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelada: 'bg-slate-100 text-slate-500 border-slate-200',
};

const EMPTY_SUB: SubscriptionInput = {
  service_name: '', provider: '', category: '', billing_type: 'fixo', periodicity: 'mensal',
  amount: 0, total_licenses: 1, renewal_date: '', billing_day: null, auto_renew: true,
  status: 'ativa', admin_email: '', notes: '',
};

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const diff = new Date(`${iso}T12:00:00`).getTime() - new Date(`${todayISO()}T12:00:00`).getTime();
  return Math.round(diff / 86400000);
}

const Modal: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({
  title, onClose, children, wide,
}) => (
  <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-2xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-4 ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
      <div className="flex items-center justify-between border-b pb-3 border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">{title}</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const Subscriptions: React.FC = () => {
  const { profile } = useAuth();
  const perms = profile ? ROLE_PERMISSIONS[profile.role]?.subscriptions : undefined;
  const canEdit = !!perms?.canEdit;
  const canDelete = !!perms?.canDelete;

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [assignments, setAssignments] = useState<SubscriptionAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const [subForm, setSubForm] = useState<SubscriptionInput | null>(null);
  const [assignFor, setAssignFor] = useState<Subscription | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');

  const flash = (f: Feedback) => {
    setFeedback(f);
    if (f?.type === 'success') setTimeout(() => setFeedback(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, a] = await Promise.all([SubscriptionService.list(), SubscriptionService.listAssignments()]);
      setSubs(s);
      setAssignments(a);
    } catch (err: any) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
    EmployeeService.getEmployees().then(setEmployees).catch(() => setEmployees([]));
  };

  useEffect(() => {
    load();
  }, []);

  const assignedCount = (subId: string) => assignments.filter((a) => a.subscription_id === subId).length;

  const activeSubs = subs.filter((s) => s.status === 'ativa');
  const monthlyTotal = activeSubs.reduce((sum, s) => sum + monthlyCost(s), 0);

  // ---------- Ações: contratos ----------
  const saveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subForm) return;
    setBusy(true);
    try {
      const saved = await SubscriptionService.save({
        ...subForm,
        amount: Number(subForm.amount) || 0,
        total_licenses: Number(subForm.total_licenses) || 0,
        billing_day: subForm.billing_day ? Number(subForm.billing_day) : null,
      });
      setSubs((prev) =>
        [...prev.filter((s) => s.id !== saved.id), saved].sort((a, b) => a.service_name.localeCompare(b.service_name))
      );
      setSubForm(null);
      flash({ type: 'success', text: `${saved.service_name} salvo.` });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const deleteSub = async (s: Subscription) => {
    if (!window.confirm(`Excluir "${s.service_name}"? As licenças atribuídas a ela também serão removidas.`)) return;
    try {
      await SubscriptionService.remove(s.id);
      setSubs((prev) => prev.filter((x) => x.id !== s.id));
      setAssignments((prev) => prev.filter((a) => a.subscription_id !== s.id));
      flash({ type: 'success', text: `${s.service_name} excluído.` });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    }
  };

  // ---------- Ações: atribuições ----------
  const assign = async () => {
    if (!assignFor || !assignEmployeeId) return;
    setBusy(true);
    try {
      await SubscriptionService.assign(assignFor.id, assignEmployeeId);
      setAssignments(await SubscriptionService.listAssignments());
      setAssignEmployeeId('');
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (a: SubscriptionAssignment) => {
    if (!window.confirm(`Remover a licença de ${a.employee_name}?`)) return;
    try {
      await SubscriptionService.unassign(a.id);
      setAssignments((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    }
  };

  // ---------- Render ----------
  const assignedToCurrent = assignFor ? assignments.filter((a) => a.subscription_id === assignFor.id) : [];
  const availableEmployees = employees
    .filter((e) => e.status !== 'desligado' && !assignedToCurrent.some((a) => a.employee_id === e.id))
    .sort((a, b) => (a.preferential_name || a.full_name).localeCompare(b.preferential_name || b.full_name));
  const licensesFull = !!assignFor && assignedToCurrent.length >= assignFor.total_licenses;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Assinaturas & Licenças</h2>
          <p className="text-slate-500 text-sm mt-1">
            Contratos SaaS e licenças por colaborador. Os custos de cada mês aparecem no módulo Financeiro.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          {canEdit && (
            <button
              onClick={() => setSubForm({ ...EMPTY_SUB })}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nova Assinatura
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{loadError}</span>
        </div>
      )}

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          )}
          <span className="flex-1">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {subs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Summary label="Assinaturas ativas" value={String(activeSubs.length)} />
          <Summary label="Custo mensal equivalente" value={brl(monthlyTotal)} />
          <Summary
            label="Licenças em uso"
            value={`${assignments.filter((a) => activeSubs.some((s) => s.id === a.subscription_id)).length} de ${activeSubs.reduce((n, s) => n + s.total_licenses, 0)}`}
          />
        </div>
      )}

      {/* ===== Contratos ===== */}
      {(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {subs.map((s) => {
            const used = assignedCount(s.id);
            const pct = s.total_licenses > 0 ? Math.min(100, (used / s.total_licenses) * 100) : 0;
            const renewIn = daysUntil(s.renewal_date);
            const renewSoon = renewIn !== null && renewIn >= 0 && renewIn <= 30;
            return (
              <div key={s.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {s.category && (
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{s.category}</span>
                    )}
                    <h3 className="text-lg font-bold text-slate-800 mt-0.5 truncate">{s.service_name}</h3>
                    {s.provider && <p className="text-xs text-slate-500">{s.provider}</p>}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[s.status]}`}>
                    {s.status.toUpperCase()}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>Licenças atribuídas:</span>
                    <span className={`font-bold ${used > s.total_licenses ? 'text-rose-600' : ''}`}>
                      {used} de {s.total_licenses} ({Math.max(0, s.total_licenses - used)} disponíveis)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-amber-500' : 'bg-blue-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 border-t pt-3 border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Valor ({PERIODICITY_LABEL[s.periodicity]}):</span>
                    <span className="font-bold text-slate-800 text-sm">{brl(s.amount)}</span>
                    {s.periodicity === 'anual' && (
                      <span className="block text-slate-400">≈ {brl(monthlyCost(s))}/mês</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block">Renovação:</span>
                    <span className={`font-semibold ${renewSoon ? 'text-amber-600' : 'text-slate-800'}`}>
                      {formatDate(s.renewal_date)}
                    </span>
                    {renewSoon && <span className="block text-amber-600">em {renewIn} dia(s)</span>}
                    {s.renewal_date && !s.auto_renew && <span className="block text-slate-400">sem renovação automática</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500 truncate">{s.admin_email ? `Admin: ${s.admin_email}` : ''}</span>
                  <div className="flex items-center gap-3">
                    {canEdit && (
                      <button onClick={() => setSubForm({ ...s })} className="text-slate-500 hover:text-slate-800" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => deleteSub(s)} className="text-slate-400 hover:text-rose-600" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setAssignFor(s);
                        setAssignEmployeeId('');
                      }}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Gerenciar Atribuições →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && subs.length === 0 && !loadError && (
            <div className="md:col-span-2 bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Nenhuma assinatura cadastrada.
              {canEdit && ' Clique em "Nova Assinatura" para começar.'}
            </div>
          )}
        </div>
      )}

      {/* ===== Modal: assinatura ===== */}
      {subForm && (
        <Modal title={<><CreditCard className="w-5 h-5 text-blue-600" /> {subForm.id ? 'Editar Assinatura' : 'Nova Assinatura'}</>} onClose={() => setSubForm(null)} wide>
          <form onSubmit={saveSub} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="sm:col-span-2">
              <label className={labelClass}>Serviço *</label>
              <input required value={subForm.service_name} onChange={(e) => setSubForm({ ...subForm, service_name: e.target.value })} className={inputClass} placeholder="Ex.: Google Workspace" />
            </div>
            <div>
              <label className={labelClass}>Fornecedor</label>
              <input value={subForm.provider || ''} onChange={(e) => setSubForm({ ...subForm, provider: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Categoria</label>
              <input value={subForm.category || ''} onChange={(e) => setSubForm({ ...subForm, category: e.target.value })} className={inputClass} placeholder="Ex.: Produtividade & E-mail" />
            </div>
            <div>
              <label className={labelClass}>Periodicidade</label>
              <select value={subForm.periodicity} onChange={(e) => setSubForm({ ...subForm, periodicity: e.target.value as any })} className={inputClass}>
                {Object.entries(PERIODICITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {subForm.periodicity === 'anual' ? 'Valor anual (R$)' : 'Valor mensal (R$)'}
              </label>
              <input type="number" min="0" step="0.01" value={subForm.amount} onChange={(e) => setSubForm({ ...subForm, amount: e.target.value as any })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Tipo de cobrança</label>
              <select value={subForm.billing_type} onChange={(e) => setSubForm({ ...subForm, billing_type: e.target.value as any })} className={inputClass}>
                <option value="fixo">Valor fixo</option>
                <option value="por_usuario">Por usuário</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Total de licenças</label>
              <input type="number" min="0" step="1" value={subForm.total_licenses} onChange={(e) => setSubForm({ ...subForm, total_licenses: e.target.value as any })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Data de renovação</label>
              <input type="date" value={subForm.renewal_date || ''} onChange={(e) => setSubForm({ ...subForm, renewal_date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Dia de vencimento</label>
              <input type="number" min="1" max="31" value={subForm.billing_day ?? ''} onChange={(e) => setSubForm({ ...subForm, billing_day: e.target.value ? Number(e.target.value) : null })} className={inputClass} placeholder="Ex.: 10" />
            </div>
            <div>
              <label className={labelClass}>Situação</label>
              <select value={subForm.status} onChange={(e) => setSubForm({ ...subForm, status: e.target.value as SubscriptionStatus })} className={inputClass}>
                <option value="ativa">Ativa</option>
                <option value="suspensa">Suspensa</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>E-mail do admin da conta</label>
              <input type="email" value={subForm.admin_email || ''} onChange={(e) => setSubForm({ ...subForm, admin_email: e.target.value })} className={inputClass} placeholder="ti@geniantis.com" />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={subForm.auto_renew} onChange={(e) => setSubForm({ ...subForm, auto_renew: e.target.checked })} />
              Renovação automática
            </label>
            <div className="sm:col-span-2">
              <label className={labelClass}>Observações</label>
              <textarea rows={2} value={subForm.notes || ''} onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })} className={inputClass} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setSubForm(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                {busy ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===== Modal: atribuições ===== */}
      {assignFor && (
        <Modal title={<><Users className="w-5 h-5 text-blue-600" /> Licenças — {assignFor.service_name}</>} onClose={() => setAssignFor(null)} wide>
          <div className="text-sm text-slate-600">
            <strong>{assignedToCurrent.length}</strong> de <strong>{assignFor.total_licenses}</strong> licenças em uso.
          </div>

          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
                className={inputClass}
                disabled={licensesFull}
              >
                <option value="">{licensesFull ? 'Todas as licenças estão em uso' : 'Selecione um funcionário...'}</option>
                {availableEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.preferential_name || e.full_name} — {e.email}
                  </option>
                ))}
              </select>
              <button
                onClick={assign}
                disabled={!assignEmployeeId || busy || licensesFull}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" /> Atribuir
              </button>
            </div>
          )}
          {licensesFull && canEdit && (
            <p className="text-xs text-amber-600">Aumente o total de licenças da assinatura para atribuir mais.</p>
          )}

          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
            {assignedToCurrent.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <div className="font-semibold text-slate-800">
                    {a.employee_name}
                    {a.employee_status === 'desligado' && (
                      <span className="ml-2 text-[10px] font-bold text-rose-600">DESLIGADO — libere a licença</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {a.employee_email}
                    {a.employee_department ? ` · ${a.employee_department}` : ''} · desde {formatDate(a.assigned_at)}
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => unassign(a)} className="text-xs font-semibold text-rose-600 hover:underline">
                    Remover
                  </button>
                )}
              </div>
            ))}
            {assignedToCurrent.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma licença atribuída.</div>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
};

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-white px-5 py-4 rounded-2xl border border-slate-200 shadow-sm">
    <span className="text-xs text-slate-500 uppercase font-semibold">{label}</span>
    <div className="text-xl font-bold text-slate-800 mt-1">{value}</div>
  </div>
);
