import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, AlertTriangle, Building2, CheckCircle2, ExternalLink, FileText, Mail, Pencil, Phone, Plus, Search, Trash2, UserPlus, X,
} from 'lucide-react';
import { usePermission } from '../lib/usePermission';
import { daysUntil, noticeDeadline, SupplierService } from '../services/supplierService';
import { brl, formatDate } from '../services/subscriptionService';
import {
  CONTRACT_STATUS_LABEL, ContractStatus, Supplier, SUPPLIER_CATEGORY_LABEL, SupplierCategory, SupplierContract,
  SupplierContractInput, SupplierInput,
} from '../types/supplier';

type Feedback = { type: 'success' | 'error'; text: string } | null;

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white';
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-1';

const CONTRACT_STYLE: Record<ContractStatus, string> = {
  vigente: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  encerrado: 'bg-slate-100 text-slate-500 border-slate-200',
  cancelado: 'bg-rose-50 text-rose-600 border-rose-200',
};

const EMPTY_SUPPLIER: SupplierInput = {
  name: '', legal_name: '', cnpj: '', category: 'outros', status: 'ativo', phone: '', email: '', website: '',
  support_phone: '', support_email: '', support_url: '', customer_number: '', contacts: [], address: '', notes: '',
};

const emptyContract = (supplierId = ''): SupplierContractInput => ({
  supplier_id: supplierId, name: '', contract_number: '', start_date: '', end_date: '', monthly_amount: 0, billing_day: null,
  auto_renew: true, notice_days: null, readjustment: '', penalty: '', status: 'vigente', file_path: null, file_name: null, notes: '',
});

const ALERT_DAYS = 60;

const withProtocol = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const Modal: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4">
      <div className="flex items-center justify-between border-b pb-3 border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">{title}</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>
      {children}
    </div>
  </div>
);

/** Situação de prazo de um contrato vigente: vencimento e último dia para cancelar */
function contractWarnings(c: SupplierContract): string[] {
  if (c.status !== 'vigente') return [];
  const out: string[] = [];
  const deadline = noticeDeadline(c);
  if (deadline) {
    const d = daysUntil(deadline);
    if (d >= 0 && d <= ALERT_DAYS) out.push(`Prazo para pedir cancelamento: ${formatDate(deadline)} (${d === 0 ? 'hoje' : `em ${d} dia(s)`})`);
  }
  if (c.end_date) {
    const d = daysUntil(c.end_date);
    if (d < 0 && !c.auto_renew) out.push(`Venceu em ${formatDate(c.end_date)}`);
    else if (d >= 0 && d <= ALERT_DAYS) out.push(`${c.auto_renew ? 'Renova' : 'Vence'} em ${d === 0 ? 'hoje' : `${d} dia(s)`} (${formatDate(c.end_date)})`);
  }
  return out;
}

export const Suppliers: React.FC = () => {
  const { canEdit, canDelete } = usePermission('suppliers');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [contracts, setContracts] = useState<SupplierContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'todas' | SupplierCategory>('todas');
  const [showInactive, setShowInactive] = useState(false);

  const [supplierForm, setSupplierForm] = useState<SupplierInput | null>(null);
  const [contractForm, setContractForm] = useState<SupplierContractInput | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const flash = (f: Feedback) => {
    setFeedback(f);
    if (f?.type === 'success') setTimeout(() => setFeedback(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([SupplierService.list(), SupplierService.listContracts()]);
      setSuppliers(s);
      setContracts(c);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Não foi possível carregar os fornecedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const contractsBySupplier = useMemo(() => {
    const map = new Map<string, SupplierContract[]>();
    for (const c of contracts) map.set(c.supplier_id, [...(map.get(c.supplier_id) || []), c]);
    return map;
  }, [contracts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (!showInactive && s.status === 'inativo') return false;
      if (category !== 'todas' && s.category !== category) return false;
      if (!term) return true;
      return [s.name, s.legal_name, s.cnpj, s.customer_number, ...s.contacts.map((c) => c.name)]
        .some((v) => v?.toLowerCase().includes(term));
    });
  }, [suppliers, search, category, showInactive]);

  const activeContracts = contracts.filter((c) => c.status === 'vigente');
  const monthlyTotal = activeContracts.reduce((n, c) => n + c.monthly_amount, 0);
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || '—';
  const alerts = activeContracts.flatMap((c) => contractWarnings(c).map((text) => ({ id: c.id, text: `${supplierName(c.supplier_id)} · ${c.name}: ${text}` })));

  const saveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm) return;
    setBusy(true);
    setFormError(null);
    try {
      await SupplierService.save(supplierForm);
      setSupplierForm(null);
      await load();
      flash({ type: 'success', text: 'Fornecedor salvo.' });
    } catch (err: any) {
      setFormError(err?.message || 'Não foi possível salvar o fornecedor.');
    } finally {
      setBusy(false);
    }
  };

  const deleteSupplier = async (s: Supplier) => {
    if (!window.confirm(`Excluir o fornecedor "${s.name}"? Assinaturas e manutenções ligadas a ele ficam sem vínculo.`)) return;
    try {
      await SupplierService.remove(s.id);
      await load();
      flash({ type: 'success', text: 'Fornecedor excluído.' });
    } catch (err: any) {
      flash({ type: 'error', text: err?.message || 'Não foi possível excluir.' });
    }
  };

  const openContract = (c: SupplierContractInput) => {
    setContractForm(c);
    setContractFile(null);
    setFormError(null);
  };

  const saveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractForm) return;
    if (!contractForm.supplier_id) {
      setFormError('Escolha o fornecedor.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await SupplierService.saveContract(contractForm, contractFile);
      setContractForm(null);
      await load();
      flash({ type: 'success', text: 'Contrato salvo.' });
    } catch (err: any) {
      setFormError(err?.message || 'Não foi possível salvar o contrato.');
    } finally {
      setBusy(false);
    }
  };

  const deleteContract = async (c: SupplierContract) => {
    if (!window.confirm(`Excluir o contrato "${c.name}"?`)) return;
    try {
      await SupplierService.removeContract(c.id);
      await load();
      flash({ type: 'success', text: 'Contrato excluído.' });
    } catch (err: any) {
      flash({ type: 'error', text: err?.message || 'Não foi possível excluir.' });
    }
  };

  const openPdf = async (c: SupplierContract) => {
    if (!c.file_path) return;
    try {
      window.open(await SupplierService.getContractUrl(c.file_path), '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      flash({ type: 'error', text: err?.message || 'Não foi possível abrir o PDF.' });
    }
  };

  const setContact = (index: number, field: 'name' | 'role' | 'phone' | 'email', value: string) => {
    if (!supplierForm) return;
    const contacts = supplierForm.contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    setSupplierForm({ ...supplierForm, contacts });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Fornecedores & Contratos</h2>
          <p className="text-slate-500 text-sm mt-1">Empresas parceiras, contatos de suporte e contratos de serviço (telefonia, link de internet, câmeras…). Software com licenças por pessoa fica em Assinaturas & Licenças.</p>
        </div>
        {canEdit && (
          <div className="mt-4 md:mt-0 flex gap-2">
            <button type="button" onClick={() => openContract(emptyContract())} disabled={suppliers.length === 0} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-semibold"><FileText className="w-4 h-4" /> Novo Contrato</button>
            <button type="button" onClick={() => { setSupplierForm({ ...EMPTY_SUPPLIER }); setFormError(null); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm"><Plus className="w-4 h-4" /> Novo Fornecedor</button>
          </div>
        )}
      </div>

      {loadError && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2"><AlertCircle className="w-5 h-5 shrink-0" /><span>{loadError}</span></div>}
      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 border ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />}
          <span className="flex-1">{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Summary label="Fornecedores ativos" value={String(suppliers.filter((s) => s.status === 'ativo').length)} />
        <Summary label="Contratos vigentes" value={String(activeContracts.length)} />
        <Summary label="Custo mensal em contratos" value={brl(monthlyTotal)} />
        <Summary label={`Prazos em ${ALERT_DAYS} dias`} value={String(alerts.length)} highlight={alerts.length > 0} />
      </div>

      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-1">
          <span className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Atenção aos prazos</span>
          <ul className="text-xs space-y-0.5 pl-6 list-disc">{alerts.map((a, i) => <li key={`${a.id}-${i}`}>{a.text}</li>)}</ul>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ, nº de cliente ou contato" className={`${inputClass} pl-9`} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value as any)} className={`${inputClass} md:w-60`}>
          <option value="todas">Todas as categorias</option>
          {Object.entries(SUPPLIER_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="w-4 h-4 rounded" /> Mostrar inativos
        </label>
      </div>

      {loading ? (
        <div className="text-center text-sm text-slate-500 py-10">Carregando fornecedores...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((s) => {
            const list = contractsBySupplier.get(s.id) || [];
            return (
              <div key={s.id} className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 ${s.status === 'inativo' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{SUPPLIER_CATEGORY_LABEL[s.category]}</span>
                    <h3 className="text-lg font-bold text-slate-800 mt-0.5 truncate">{s.name}</h3>
                    {(s.legal_name || s.cnpj) && <p className="text-xs text-slate-500 truncate">{[s.legal_name, s.cnpj].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.status === 'inativo' && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-100 text-slate-500 border-slate-200">INATIVO</span>}
                    {canEdit && <button type="button" onClick={() => { setSupplierForm({ ...s }); setFormError(null); }} className="text-slate-500 hover:text-slate-800" title="Editar"><Pencil className="w-4 h-4" /></button>}
                    {canDelete && <button type="button" onClick={() => deleteSupplier(s)} className="text-slate-400 hover:text-rose-600" title="Excluir"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                  <div className="space-y-1">
                    <span className="text-slate-400 block uppercase font-semibold text-[10px]">Suporte</span>
                    {s.support_phone && <a href={`tel:${s.support_phone}`} className="flex items-center gap-1.5 hover:text-blue-700"><Phone className="w-3.5 h-3.5" /> {s.support_phone}</a>}
                    {s.support_email && <a href={`mailto:${s.support_email}`} className="flex items-center gap-1.5 hover:text-blue-700 truncate"><Mail className="w-3.5 h-3.5" /> {s.support_email}</a>}
                    {s.support_url && <a href={withProtocol(s.support_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-blue-700 truncate"><ExternalLink className="w-3.5 h-3.5" /> Portal de suporte</a>}
                    {!s.support_phone && !s.support_email && !s.support_url && <span className="text-slate-400">Não informado</span>}
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block uppercase font-semibold text-[10px]">Conta</span>
                    {s.customer_number && <span className="block">Nº cliente: <strong className="text-slate-800">{s.customer_number}</strong></span>}
                    {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 hover:text-blue-700"><Phone className="w-3.5 h-3.5" /> {s.phone}</a>}
                    {s.website && <a href={withProtocol(s.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-blue-700 truncate"><ExternalLink className="w-3.5 h-3.5" /> Site</a>}
                    {s.contacts.length > 0 && <span className="block">{s.contacts.map((c) => [c.name, c.role].filter(Boolean).join(' – ')).join(', ')}</span>}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Contratos ({list.length})</span>
                    {canEdit && <button type="button" onClick={() => openContract(emptyContract(s.id))} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"><Plus className="w-3.5 h-3.5" /> Contrato</button>}
                  </div>
                  {list.length === 0 && <p className="text-xs text-slate-400">Nenhum contrato cadastrado.</p>}
                  {list.map((c) => {
                    const warnings = contractWarnings(c);
                    return (
                      <div key={c.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800">{c.name}</span>
                            {c.contract_number && <span className="text-slate-400"> · nº {c.contract_number}</span>}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${CONTRACT_STYLE[c.status]}`}>{CONTRACT_STATUS_LABEL[c.status].toUpperCase()}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-600">
                          <span>Vigência: {c.start_date ? formatDate(c.start_date) : '—'} a {c.end_date ? formatDate(c.end_date) : 'indeterminado'}</span>
                          {c.monthly_amount > 0 && <span>Mensal: <strong className="text-slate-800">{brl(c.monthly_amount)}</strong></span>}
                          {c.notice_days ? <span>Aviso prévio: {c.notice_days} dias</span> : null}
                          {c.auto_renew && <span>Renovação automática</span>}
                        </div>
                        {warnings.map((w) => <p key={w} className="text-amber-700 font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {w}</p>)}
                        <div className="flex justify-end gap-3 pt-1">
                          {c.file_path && <button type="button" onClick={() => openPdf(c)} className="font-semibold text-emerald-600 hover:text-emerald-800">PDF</button>}
                          {canEdit && <button type="button" onClick={() => openContract({ ...c })} className="font-semibold text-slate-600 hover:text-slate-900">Editar</button>}
                          {canDelete && <button type="button" onClick={() => deleteContract(c)} className="font-semibold text-slate-400 hover:text-rose-600">Excluir</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && !loadError && (
            <div className="lg:col-span-2 bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-500">
              <Building2 className="w-6 h-6 mx-auto mb-2 text-slate-400" />
              {suppliers.length === 0 ? 'Nenhum fornecedor cadastrado.' : 'Nenhum fornecedor encontrado com esses filtros.'}
              {canEdit && suppliers.length === 0 && ' Clique em "Novo Fornecedor" para começar.'}
            </div>
          )}
        </div>
      )}

      {/* ===== Modal: fornecedor ===== */}
      {supplierForm && (
        <Modal title={<><Building2 className="w-5 h-5 text-blue-600" /> {supplierForm.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}</>} onClose={() => setSupplierForm(null)}>
          <form onSubmit={saveSupplier} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {formError && <div className="sm:col-span-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-xs">{formError}</div>}
            <div><label className={labelClass}>Nome *</label><input required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className={inputClass} placeholder="Ex.: Vivo Empresas" /></div>
            <div><label className={labelClass}>Categoria</label><select value={supplierForm.category} onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value as SupplierCategory })} className={inputClass}>{Object.entries(SUPPLIER_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className={labelClass}>Razão social</label><input value={supplierForm.legal_name || ''} onChange={(e) => setSupplierForm({ ...supplierForm, legal_name: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>CNPJ</label><input value={supplierForm.cnpj || ''} onChange={(e) => setSupplierForm({ ...supplierForm, cnpj: e.target.value })} className={inputClass} placeholder="00.000.000/0000-00" /></div>
            <div><label className={labelClass}>Nº de cliente / conta</label><input value={supplierForm.customer_number || ''} onChange={(e) => setSupplierForm({ ...supplierForm, customer_number: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Situação</label><select value={supplierForm.status} onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value as any })} className={inputClass}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></div>

            <div className="sm:col-span-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500 uppercase">Suporte</div>
            <div><label className={labelClass}>Telefone de suporte</label><input value={supplierForm.support_phone || ''} onChange={(e) => setSupplierForm({ ...supplierForm, support_phone: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>E-mail de suporte</label><input type="email" value={supplierForm.support_email || ''} onChange={(e) => setSupplierForm({ ...supplierForm, support_email: e.target.value })} className={inputClass} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>Portal de suporte (link)</label><input value={supplierForm.support_url || ''} onChange={(e) => setSupplierForm({ ...supplierForm, support_url: e.target.value })} className={inputClass} placeholder="https://..." /></div>

            <div className="sm:col-span-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500 uppercase">Comercial</div>
            <div><label className={labelClass}>Telefone</label><input value={supplierForm.phone || ''} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>E-mail</label><input type="email" value={supplierForm.email || ''} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Site</label><input value={supplierForm.website || ''} onChange={(e) => setSupplierForm({ ...supplierForm, website: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Endereço</label><input value={supplierForm.address || ''} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} className={inputClass} /></div>

            <div className="sm:col-span-2 border-t border-slate-100 pt-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Contatos</span>
              <button type="button" onClick={() => setSupplierForm({ ...supplierForm, contacts: [...supplierForm.contacts, { name: '', role: '', phone: '', email: '' }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"><UserPlus className="w-3.5 h-3.5" /> Adicionar contato</button>
            </div>
            {supplierForm.contacts.map((c, i) => (
              <div key={i} className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <input value={c.name} onChange={(e) => setContact(i, 'name', e.target.value)} placeholder="Nome" className={inputClass} />
                <input value={c.role || ''} onChange={(e) => setContact(i, 'role', e.target.value)} placeholder="Função (ex.: gerente de conta)" className={inputClass} />
                <input value={c.phone || ''} onChange={(e) => setContact(i, 'phone', e.target.value)} placeholder="Telefone" className={inputClass} />
                <input value={c.email || ''} onChange={(e) => setContact(i, 'email', e.target.value)} placeholder="E-mail" className={inputClass} />
                <button type="button" onClick={() => setSupplierForm({ ...supplierForm, contacts: supplierForm.contacts.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600 justify-self-end" title="Remover"><X className="w-4 h-4" /></button>
              </div>
            ))}

            <div className="sm:col-span-2"><label className={labelClass}>Observações</label><textarea rows={2} value={supplierForm.notes || ''} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} className={inputClass} /></div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setSupplierForm(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold">{busy ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===== Modal: contrato ===== */}
      {contractForm && (
        <Modal title={<><FileText className="w-5 h-5 text-blue-600" /> {contractForm.id ? 'Editar Contrato' : 'Novo Contrato'}</>} onClose={() => setContractForm(null)}>
          <form onSubmit={saveContract} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {formError && <div className="sm:col-span-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-xs">{formError}</div>}
            <div><label className={labelClass}>Fornecedor *</label><select required value={contractForm.supplier_id} onChange={(e) => setContractForm({ ...contractForm, supplier_id: e.target.value })} className={inputClass}><option value="">Selecione</option>{suppliers.filter((s) => s.status === 'ativo' || s.id === contractForm.supplier_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className={labelClass}>Contrato / serviço *</label><input required value={contractForm.name} onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })} className={inputClass} placeholder="Ex.: Link dedicado 500 Mb" /></div>
            <div><label className={labelClass}>Nº do contrato</label><input value={contractForm.contract_number || ''} onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Situação</label><select value={contractForm.status} onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as ContractStatus })} className={inputClass}>{Object.entries(CONTRACT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className={labelClass}>Início</label><input type="date" value={contractForm.start_date || ''} onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Fim (vazio = indeterminado)</label><input type="date" value={contractForm.end_date || ''} onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Valor mensal (R$)</label><input type="number" min="0" step="0.01" value={contractForm.monthly_amount || ''} onChange={(e) => setContractForm({ ...contractForm, monthly_amount: Number(e.target.value) })} className={inputClass} /></div>
            <div><label className={labelClass}>Dia de vencimento</label><input type="number" min="1" max="31" value={contractForm.billing_day ?? ''} onChange={(e) => setContractForm({ ...contractForm, billing_day: e.target.value ? Number(e.target.value) : null })} className={inputClass} /></div>
            <div><label className={labelClass}>Aviso prévio (dias)</label><input type="number" min="0" value={contractForm.notice_days ?? ''} onChange={(e) => setContractForm({ ...contractForm, notice_days: e.target.value ? Number(e.target.value) : null })} className={inputClass} placeholder="Ex.: 30" /></div>
            <div><label className={labelClass}>Reajuste</label><input value={contractForm.readjustment || ''} onChange={(e) => setContractForm({ ...contractForm, readjustment: e.target.value })} className={inputClass} placeholder="Ex.: IGP-M anual em março" /></div>
            <label className="sm:col-span-2 flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={contractForm.auto_renew} onChange={(e) => setContractForm({ ...contractForm, auto_renew: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-xs font-semibold text-slate-700">Renova automaticamente no fim da vigência</span></label>
            <div className="sm:col-span-2"><label className={labelClass}>Multa / fidelidade</label><input value={contractForm.penalty || ''} onChange={(e) => setContractForm({ ...contractForm, penalty: e.target.value })} className={inputClass} placeholder="Ex.: multa proporcional aos meses restantes da fidelidade de 24 meses" /></div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{contractForm.file_path ? 'Substituir PDF do contrato' : 'PDF do contrato'}</label>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => { const f = e.target.files?.[0] || null; if (f && (f.type !== 'application/pdf' || f.size > 15 * 1024 * 1024)) { setFormError('Selecione um PDF de até 15 MB.'); e.target.value = ''; setContractFile(null); return; } setFormError(null); setContractFile(f); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:rounded-md" />
              {contractFile ? <span className="text-[11px] text-emerald-700 mt-1 block">Arquivo selecionado: {contractFile.name}</span> : contractForm.file_name && <span className="text-[11px] text-slate-500 mt-1 block">PDF atual: {contractForm.file_name}</span>}
            </div>
            <div className="sm:col-span-2"><label className={labelClass}>Observações</label><textarea rows={2} value={contractForm.notes || ''} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} className={inputClass} /></div>
            <p className="sm:col-span-2 text-[11px] text-slate-500">O valor mensal entra no Financeiro. Se este serviço já está cadastrado em Assinaturas & Licenças com valor, deixe o valor aqui em branco para não contar duas vezes.</p>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setContractForm(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold">{busy ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const Summary: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`bg-white px-5 py-4 rounded-2xl border shadow-sm ${highlight ? 'border-amber-300' : 'border-slate-200'}`}>
    <span className="text-xs text-slate-500 uppercase font-semibold">{label}</span>
    <div className={`text-xl font-bold mt-1 ${highlight ? 'text-amber-700' : 'text-slate-800'}`}>{value}</div>
  </div>
);
