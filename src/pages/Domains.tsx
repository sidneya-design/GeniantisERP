import React, { useEffect, useMemo, useState } from 'react';
import {
  Globe, Plus, AlertCircle, CheckCircle2, Clock, X, Pencil, Trash2, RefreshCw, History, RotateCw, Search,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_PERMISSIONS } from '../lib/permissions';
import {
  Domain, DomainInput, DomainRenewal, DomainService, ExpiryLevel, daysToExpire, expiryLevel, plusOneYear,
} from '../services/domainService';
import { brl, formatDate, todayISO } from '../services/subscriptionService';

type Feedback = { type: 'success' | 'error'; text: string } | null;

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white';
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-1';

const LEVEL: Record<ExpiryLevel, { label: (d: number | null) => string; cls: string }> = {
  ok: { label: () => 'Em dia', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  soon: { label: (d) => `Vence em ${d} dias`, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  urgent: { label: (d) => (d === 0 ? 'Vence hoje' : `Vence em ${d} dia${d === 1 ? '' : 's'}`), cls: 'bg-orange-50 text-orange-700 border-orange-300' },
  expired: { label: (d) => `Vencido há ${Math.abs(d || 0)} dia(s)`, cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  none: { label: () => 'Sem vencimento', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  cancelled: { label: () => 'Cancelado', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const CRITICALITY: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

const EMPTY: DomainInput = {
  domain: '', is_subdomain: false, parent_domain: '', registrar: '', organization: '', admin_email: '',
  responsible: '', backup_responsible: '', expiration_date: '', auto_renew: false, renewal_cost: null,
  criticality: 'media', status: 'ativo', services: [], notes: '',
};

const Modal: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
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

export const Domains: React.FC = () => {
  const { profile } = useAuth();
  const perms = profile ? ROLE_PERMISSIONS[profile.role]?.domains : undefined;
  const canEdit = !!perms?.canEdit;
  const canDelete = !!perms?.canDelete;

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);

  const [form, setForm] = useState<DomainInput | null>(null);
  const [servicesText, setServicesText] = useState('');
  const [renewFor, setRenewFor] = useState<Domain | null>(null);
  const [renewForm, setRenewForm] = useState({ new_expiration: '', renewed_at: '', cost: '', notes: '' });
  const [historyFor, setHistoryFor] = useState<Domain | null>(null);
  const [history, setHistory] = useState<DomainRenewal[] | null>(null);

  const flash = (f: Feedback) => {
    setFeedback(f);
    if (f?.type === 'success') setTimeout(() => setFeedback(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setDomains(await DomainService.list());
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const active = domains.filter((d) => d.status === 'ativo');
  const expiringSoon = active.filter((d) => ['soon', 'urgent'].includes(expiryLevel(d)));
  const expired = active.filter((d) => expiryLevel(d) === 'expired');
  const attention = [...expired, ...expiringSoon].sort((a, b) => (daysToExpire(a) ?? 0) - (daysToExpire(b) ?? 0));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return domains
      .filter((d) => showCancelled || d.status !== 'cancelado')
      .filter((d) => !q || [d.domain, d.registrar, d.responsible, ...d.services].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        // cancelados por último; depois por vencimento mais próximo
        if (a.status !== b.status) return a.status === 'cancelado' ? 1 : -1;
        return (a.expiration_date || '9999').localeCompare(b.expiration_date || '9999');
      });
  }, [domains, search, showCancelled]);

  const openForm = (d?: Domain) => {
    setForm(d ? { ...d } : { ...EMPTY });
    setServicesText(d ? d.services.join(', ') : '');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const saved = await DomainService.save({ ...form, services: servicesText.split(',') });
      setDomains((prev) => [...prev.filter((x) => x.id !== saved.id), saved]);
      setForm(null);
      flash({ type: 'success', text: `${saved.domain} salvo.` });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: Domain) => {
    if (!window.confirm(`Excluir ${d.domain}? O histórico de renovações também será apagado.`)) return;
    try {
      await DomainService.remove(d.id);
      setDomains((prev) => prev.filter((x) => x.id !== d.id));
      flash({ type: 'success', text: `${d.domain} excluído.` });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    }
  };

  const openRenew = (d: Domain) => {
    setRenewFor(d);
    setRenewForm({
      new_expiration: plusOneYear(d.expiration_date),
      renewed_at: todayISO(),
      cost: d.renewal_cost !== null ? String(d.renewal_cost) : '',
      notes: '',
    });
  };

  const renew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewFor) return;
    setBusy(true);
    try {
      await DomainService.renew(renewFor.id, {
        new_expiration: renewForm.new_expiration,
        renewed_at: renewForm.renewed_at,
        cost: renewForm.cost === '' ? null : Number(renewForm.cost),
        notes: renewForm.notes,
      });
      await load();
      flash({ type: 'success', text: `${renewFor.domain} renovado até ${formatDate(renewForm.new_expiration)}.` });
      setRenewFor(null);
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (d: Domain) => {
    setHistoryFor(d);
    setHistory(null);
    try {
      setHistory(await DomainService.renewals(d.id));
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
      setHistoryFor(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Domínios & Renovações</h2>
          <p className="text-slate-500 text-sm mt-1">Domínios, registradoras, responsáveis, vencimentos e histórico de renovações.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          {canEdit && (
            <button onClick={() => openForm()} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Novo Domínio
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
        <div className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 border ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />}
          <span className="flex-1">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Summary label="Domínios ativos" value={String(active.length)} />
        <Summary label="Vencem em até 30 dias" value={String(expiringSoon.length)} tone={expiringSoon.length ? 'amber' : undefined} />
        <Summary label="Vencidos" value={String(expired.length)} tone={expired.length ? 'rose' : undefined} />
      </div>

      {/* Atenção */}
      {!loading && !loadError && (
        attention.length ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Renovações que pedem atenção</span>
              <ul className="space-y-0.5">
                {attention.map((d) => {
                  const days = daysToExpire(d)!;
                  return (
                    <li key={d.id}>
                      <strong>{d.domain}</strong> — {days < 0 ? `vencido desde ${formatDate(d.expiration_date)}` : days === 0 ? 'vence hoje' : `vence em ${days} dia(s), ${formatDate(d.expiration_date)}`}
                      {d.auto_renew ? ' (renovação automática)' : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : domains.length > 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Nenhuma renovação nos próximos 30 dias.
          </div>
        ) : null
      )}

      {/* Filtros */}
      {domains.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar domínio, registradora, responsável..." className={`${inputClass} pl-9`} />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Mostrar cancelados
          </label>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((d) => {
          const days = daysToExpire(d);
          const level = LEVEL[expiryLevel(d)];
          return (
            <div key={d.id} className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 ${d.status === 'cancelado' ? 'opacity-60' : ''}`}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 text-base truncate" title={d.domain}>{d.domain}</h3>
                      <span className="text-xs text-slate-400">
                        {d.is_subdomain ? `Subdomínio de ${d.parent_domain || '—'}` : d.registrar || 'Registradora não informada'}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${level.cls}`}>
                    {level.label(days)}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <Row label="Vencimento" value={formatDate(d.expiration_date)} strong />
                  <Row label="Responsável" value={d.responsible || '—'} />
                  {d.backup_responsible && <Row label="Substituto" value={d.backup_responsible} />}
                  <Row label="Criticidade" value={CRITICALITY[d.criticality]} strong />
                  {d.renewal_cost !== null && <Row label="Custo da renovação" value={brl(d.renewal_cost)} />}
                </div>

                {d.services.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Serviços vinculados</span>
                    <div className="flex flex-wrap gap-1">
                      {d.services.map((svc) => (
                        <span key={svc} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">{svc}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-3 border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={d.auto_renew ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  {d.auto_renew ? '✓ Renovação automática' : 'Renovação manual'}
                </span>
                <div className="flex items-center gap-3">
                  <button onClick={() => openHistory(d)} className="text-slate-500 hover:text-slate-800" title="Histórico de renovações">
                    <History className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <button onClick={() => openForm(d)} className="text-slate-500 hover:text-slate-800" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => remove(d)} className="text-slate-400 hover:text-rose-600" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {canEdit && d.status === 'ativo' && (
                    <button onClick={() => openRenew(d)} className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold">
                      <RotateCw className="w-3.5 h-3.5" /> Renovar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!loading && !loadError && visible.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            {domains.length ? 'Nenhum domínio encontrado com esse filtro.' : `Nenhum domínio cadastrado.${canEdit ? ' Clique em "Novo Domínio" para começar.' : ''}`}
          </div>
        )}
      </div>

      {/* Modal: domínio */}
      {form && (
        <Modal title={<><Globe className="w-5 h-5 text-blue-600" /> {form.id ? 'Editar Domínio' : 'Novo Domínio'}</>} onClose={() => setForm(null)} wide>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="sm:col-span-2">
              <label className={labelClass}>Domínio *</label>
              <input required value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className={inputClass} placeholder="geniantis.com.br" />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_subdomain} onChange={(e) => setForm({ ...form, is_subdomain: e.target.checked })} />
              É um subdomínio (ex.: app.geniantis.com.br)
            </label>
            {form.is_subdomain && (
              <div className="sm:col-span-2">
                <label className={labelClass}>Domínio principal</label>
                <input value={form.parent_domain || ''} onChange={(e) => setForm({ ...form, parent_domain: e.target.value })} className={inputClass} placeholder="geniantis.com.br" />
              </div>
            )}
            <div>
              <label className={labelClass}>Registradora / provedor</label>
              <input value={form.registrar || ''} onChange={(e) => setForm({ ...form, registrar: e.target.value })} className={inputClass} placeholder="Registro.br, Cloudflare..." />
            </div>
            <div>
              <label className={labelClass}>Titular (organização)</label>
              <input value={form.organization || ''} onChange={(e) => setForm({ ...form, organization: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Responsável</label>
              <input value={form.responsible || ''} onChange={(e) => setForm({ ...form, responsible: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Substituto</label>
              <input value={form.backup_responsible || ''} onChange={(e) => setForm({ ...form, backup_responsible: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>E-mail de administração</label>
              <input type="email" value={form.admin_email || ''} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} className={inputClass} placeholder="ti@geniantis.com" />
            </div>
            <div>
              <label className={labelClass}>Vencimento</label>
              <input type="date" value={form.expiration_date || ''} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Custo da renovação (R$)</label>
              <input type="number" min="0" step="0.01" value={form.renewal_cost ?? ''} onChange={(e) => setForm({ ...form, renewal_cost: e.target.value === '' ? null : (e.target.value as any) })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Criticidade</label>
              <select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value as any })} className={inputClass}>
                <option value="alta">Alta — fora do ar para tudo</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Situação</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className={inputClass}>
                <option value="ativo">Ativo</option>
                <option value="cancelado">Cancelado / não renovar</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 self-end pb-2">
              <input type="checkbox" checked={form.auto_renew} onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} />
              Renovação automática
            </label>
            <div className="sm:col-span-2">
              <label className={labelClass}>Serviços vinculados</label>
              <input value={servicesText} onChange={(e) => setServicesText(e.target.value)} className={inputClass} placeholder="Site institucional, Google Workspace, ERP" />
              <span className="text-[11px] text-slate-400 mt-1 block">Separe por vírgula.</span>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Observações</label>
              <textarea rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} placeholder="Onde fica o DNS, conta de acesso, etc. (não coloque senhas)" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">{busy ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: renovar */}
      {renewFor && (
        <Modal title={<><RotateCw className="w-5 h-5 text-blue-600" /> Registrar renovação</>} onClose={() => setRenewFor(null)}>
          <form onSubmit={renew} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <p className="sm:col-span-2 text-slate-600">
              <strong>{renewFor.domain}</strong> — vencimento atual: <strong>{formatDate(renewFor.expiration_date)}</strong>
            </p>
            <div>
              <label className={labelClass}>Novo vencimento *</label>
              <input required type="date" value={renewForm.new_expiration} onChange={(e) => setRenewForm({ ...renewForm, new_expiration: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Renovado em</label>
              <input type="date" value={renewForm.renewed_at} onChange={(e) => setRenewForm({ ...renewForm, renewed_at: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Valor pago (R$)</label>
              <input type="number" min="0" step="0.01" value={renewForm.cost} onChange={(e) => setRenewForm({ ...renewForm, cost: e.target.value })} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Observações</label>
              <input value={renewForm.notes} onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })} className={inputClass} placeholder="Ex.: renovado por 1 ano no Registro.br" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setRenewFor(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">{busy ? 'Salvando...' : 'Registrar renovação'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: histórico */}
      {historyFor && (
        <Modal title={<><History className="w-5 h-5 text-blue-600" /> Histórico — {historyFor.domain}</>} onClose={() => setHistoryFor(null)} wide>
          {history === null ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma renovação registrada ainda.</p>
          ) : (
            <table className="w-full text-sm text-slate-600">
              <thead className="text-xs uppercase text-slate-500 bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2">Renovado em</th>
                  <th className="text-left px-3 py-2">Vencimento</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="text-left px-3 py-2">Obs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{formatDate(r.renewed_at)}</td>
                    <td className="px-3 py-2">{formatDate(r.previous_expiration)} → <strong>{formatDate(r.new_expiration)}</strong></td>
                    <td className="px-3 py-2 text-right">{r.cost !== null ? brl(r.cost) : '—'}</td>
                    <td className="px-3 py-2 text-xs">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex justify-between gap-3">
    <span className="text-slate-500">{label}:</span>
    <span className={`text-right ${strong ? 'font-semibold text-slate-800' : 'font-medium text-slate-800'}`}>{value}</span>
  </div>
);

const Summary: React.FC<{ label: string; value: string; tone?: 'amber' | 'rose' }> = ({ label, value, tone }) => (
  <div className="bg-white px-5 py-4 rounded-2xl border border-slate-200 shadow-sm">
    <span className="text-xs text-slate-500 uppercase font-semibold">{label}</span>
    <div className={`text-xl font-bold mt-1 ${tone === 'amber' ? 'text-amber-600' : tone === 'rose' ? 'text-rose-600' : 'text-slate-800'}`}>{value}</div>
  </div>
);
