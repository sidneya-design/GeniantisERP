import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Plus, ShieldAlert, Wrench, X } from 'lucide-react';
import { AssetService } from '../services/assetService';
import { MaintenanceService } from '../services/maintenanceService';
import { Asset } from '../types/asset';
import { Maintenance as MaintenanceRecord, MaintenanceStatus } from '../types/maintenance';

const statusLabel: Record<MaintenanceStatus, string> = {
  em_andamento: 'Em Reparo',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  baixado: 'Baixado / Perda',
};

const statusClass: Record<MaintenanceStatus, string> = {
  em_andamento: 'bg-amber-50 text-amber-700 border-amber-200',
  concluida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelada: 'bg-slate-100 text-slate-600 border-slate-200',
  baixado: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const Maintenance: React.FC = () => {
  const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filterStatus, setFilterStatus] = useState<'todos' | MaintenanceStatus>('todos');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [issue, setIssue] = useState('');
  const [openedAt, setOpenedAt] = useState(new Date().toISOString().split('T')[0]);
  const [forecastDate, setForecastDate] = useState('');
  const [provider, setProvider] = useState('');
  const [cost, setCost] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [completionTarget, setCompletionTarget] = useState<MaintenanceRecord | null>(null);
  const [completionInvoiceFile, setCompletionInvoiceFile] = useState<File | null>(null);
  const [completionCost, setCompletionCost] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [maintenanceData, assetData] = await Promise.all([
        MaintenanceService.getMaintenances(),
        AssetService.getAssets(),
      ]);
      setMaintenances(maintenanceData);
      setAssets(assetData);
      setErrorMessage(null);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível carregar as manutenções.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const availableAssets = useMemo(
    () => assets.filter((asset) => asset.status !== 'baixado' && asset.status !== 'em_manutencao'),
    [assets],
  );

  const filteredMaintenances = useMemo(
    () => filterStatus === 'todos' ? maintenances : maintenances.filter((item) => item.status === filterStatus),
    [filterStatus, maintenances],
  );

  const monthlySummary = useMemo(() => {
    const monthItems = maintenances.filter((item) => item.opened_at.slice(0, 7) === monthFilter);
    const total = monthItems.reduce((sum, item) => sum + (item.cost || 0), 0);
    return { count: monthItems.length, total, average: monthItems.length ? total / monthItems.length : 0 };
  }, [maintenances, monthFilter]);

  const openModal = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSelectedAssetId('');
    setIssue('');
    setOpenedAt(new Date().toISOString().split('T')[0]);
    setForecastDate('');
    setProvider('');
    setCost('');
    setInvoiceFile(null);
    setNotes('');
    setIsModalOpen(true);
    await loadData();
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const uploadedInvoice = invoiceFile ? await MaintenanceService.uploadInvoice(invoiceFile) : null;
      await MaintenanceService.saveMaintenance({
        asset_id: selectedAssetId,
        issue,
        opened_at: openedAt,
        forecast_date: forecastDate || null,
        provider: provider || null,
        cost: cost ? Number(cost) : null,
        invoice_file_path: uploadedInvoice?.path || null,
        invoice_file_name: uploadedInvoice?.name || null,
        notes: notes || null,
      });
      await loadData();
      setIsModalOpen(false);
      setSuccessMessage('Chamado de manutenção registrado com sucesso. O ativo foi marcado como Em Manutenção.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível abrir o chamado de manutenção.');
    }
  };

  const handleStatus = async (maintenance: MaintenanceRecord, status: MaintenanceStatus) => {
    if (status === 'baixado' && !window.confirm('Confirmar baixa por perda? O equipamento ficará indisponível permanentemente.')) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await MaintenanceService.updateStatus(maintenance.id, status);
      await loadData();
      setSuccessMessage(status === 'concluida' ? 'Manutenção concluída e ativo devolvido ao estoque.' : status === 'baixado' ? 'Baixa registrada. O equipamento foi marcado como perda.' : 'Manutenção cancelada e ativo devolvido ao estoque.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível atualizar a manutenção.');
    }
  };

  const openCompletionModal = (maintenance: MaintenanceRecord) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCompletionTarget(maintenance);
    setCompletionInvoiceFile(null);
    setCompletionCost(maintenance.cost === null || maintenance.cost === undefined ? '' : String(maintenance.cost));
    setCompletionNotes(maintenance.notes || '');
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!completionTarget || !completionInvoiceFile) {
      setErrorMessage('Anexe o PDF da nota fiscal ou do serviço para concluir a manutenção.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const uploadedInvoice = await MaintenanceService.uploadInvoice(completionInvoiceFile);
      await MaintenanceService.updateStatus(completionTarget.id, 'concluida', {
        invoice_file_path: uploadedInvoice.path,
        invoice_file_name: uploadedInvoice.name,
        cost: completionCost ? Number(completionCost) : null,
        notes: completionNotes || null,
      });
      await loadData();
      setCompletionTarget(null);
      setSuccessMessage('Manutenção concluída e comprovante anexado com sucesso. O ativo voltou para o estoque.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível concluir a manutenção.');
    }
  };

  const openInvoice = async (item: MaintenanceRecord) => {
    if (!item.invoice_file_path) return;
    try {
      const url = await MaintenanceService.getInvoiceUrl(item.invoice_file_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível abrir a nota fiscal.');
    }
  };

  const completionModal = completionTarget && (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div><h3 className="text-lg font-bold text-slate-800">Concluir manutenção</h3><p className="text-xs text-slate-500 mt-1">{completionTarget.patrimony} — {completionTarget.equipment}</p></div>
          <button type="button" onClick={() => setCompletionTarget(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleComplete} className="space-y-4 text-sm">
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Nota fiscal ou ordem de serviço em PDF *</span><input required type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024)) { setErrorMessage('Selecione um PDF de até 10 MB.'); event.target.value = ''; setCompletionInvoiceFile(null); return; } setErrorMessage(null); setCompletionInvoiceFile(file); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:rounded-md" />{completionInvoiceFile && <span className="text-[11px] text-emerald-700 mt-1 block">Arquivo selecionado: {completionInvoiceFile.name}</span>}</label>
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Custo final</span><input type="number" min="0" step="0.01" value={completionCost} onChange={(event) => setCompletionCost(event.target.value)} placeholder="0,00" className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Observações do serviço</span><textarea rows={3} value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} placeholder="Descreva o serviço realizado" className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => setCompletionTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button><button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold">Concluir manutenção</button></div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {completionModal}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div><h2 className="text-2xl font-bold text-slate-800">Manutenções de Equipamentos</h2><p className="text-slate-500 text-sm mt-1">Controle de chamados, assistências técnicas, custos e previsão de retorno.</p></div>
        <button type="button" onClick={openModal} className="mt-4 md:mt-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"><Plus className="w-4 h-4" /> Registrar Chamado</button>
      </div>

      {errorMessage && <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2"><ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" /><span>{errorMessage}</span></div>}
      {successMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2"><CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /><span>{successMessage}</span></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs"><div className="flex items-center justify-between mb-3"><span className="text-xs font-semibold text-slate-500">Custo mensal registrado</span><Clock className="w-4 h-4 text-blue-600" /></div><input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 mb-2" /><div className="text-xl font-bold text-slate-800">{monthlySummary.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div></div><div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs"><span className="text-xs font-semibold text-slate-500">Chamados no mês</span><div className="text-2xl font-bold text-slate-800 mt-2">{monthlySummary.count}</div><span className="text-xs text-slate-500">registro(s) pela data do chamado</span></div><div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs"><span className="text-xs font-semibold text-slate-500">Custo médio por chamado</span><div className="text-2xl font-bold text-slate-800 mt-2">{monthlySummary.average.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div><span className="text-xs text-slate-500">com base nos custos informados</span></div></div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-slate-600"><Wrench className="w-4 h-4 text-blue-600" /><span>{maintenances.length} chamado(s) registrado(s)</span></div><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as 'todos' | MaintenanceStatus)} className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700"><option value="todos">Todas as situações</option><option value="em_andamento">Em Reparo</option><option value="concluida">Concluídas</option><option value="cancelada">Canceladas</option><option value="baixado">Baixados / Perdas</option></select></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {isLoading ? <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">Carregando manutenções...</div> : filteredMaintenances.map((item) => <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-start justify-between"><div><span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{item.patrimony}</span><h3 className="font-bold text-slate-800 text-base mt-1.5">{item.equipment}</h3></div><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusClass[item.status]}`}>{statusLabel[item.status]}</span></div>
          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100"><strong>Defeito relatado:</strong> {item.issue}</p>
          <div className="text-xs space-y-1 text-slate-600 border-t pt-3 border-slate-100"><div className="flex justify-between gap-3"><span className="text-slate-500">Responsável / Assistência:</span><span className="font-medium text-slate-800 text-right">{item.provider || 'Não informado'}</span></div><div className="flex justify-between"><span className="text-slate-500">Abertura:</span><span className="font-medium text-slate-800">{new Date(`${item.opened_at}T12:00:00Z`).toLocaleDateString('pt-BR')}</span></div><div className="flex justify-between"><span className="text-slate-500">Previsão:</span><span className="font-semibold text-blue-700">{item.forecast_date ? new Date(`${item.forecast_date}T12:00:00Z`).toLocaleDateString('pt-BR') : 'Não informada'}</span></div>{item.cost !== null && item.cost !== undefined && <div className="flex justify-between"><span className="text-slate-500">Custo:</span><span className="font-semibold text-slate-800">{item.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>}</div>
          {item.custody_note && <div className="text-[11px] text-slate-500 italic border-t pt-2 border-slate-100">🛡️ {item.custody_note}</div>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3 border-slate-100">{item.invoice_file_path && <button type="button" onClick={() => openInvoice(item)} className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">Nota Fiscal PDF</button>}{item.status === 'em_andamento' && <><button type="button" onClick={() => handleStatus(item, 'cancelada')} className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button type="button" onClick={() => handleStatus(item, 'baixado')} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" /> Dar baixa por perda</button><button type="button" onClick={() => openCompletionModal(item)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /> Concluir manutenção</button></>}</div>
        </div>)}
        {!isLoading && filteredMaintenances.length === 0 && <div className="md:col-span-2 bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500"><AlertTriangle className="w-5 h-5 mx-auto mb-2 text-slate-400" />Nenhuma manutenção cadastrada.</div>}
      </div>

      {isModalOpen && <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"><div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4"><h3 className="text-lg font-bold text-slate-800">Registrar chamado de manutenção</h3><button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button></div><form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"><label className="block sm:col-span-2"><span className="block text-xs font-semibold text-slate-700 mb-1">Ativo *</span><select required value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"><option value="">Selecione o ativo</option>{availableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.patrimony} — {[asset.brand, asset.model].filter(Boolean).join(' ') || asset.category} ({asset.status === 'em_uso' ? 'Em uso' : 'Disponível'})</option>)}</select></label><label className="block sm:col-span-2"><span className="block text-xs font-semibold text-slate-700 mb-1">Defeito relatado *</span><textarea required rows={3} value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="Descreva o problema ou serviço necessário" className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Data do chamado *</span><input required type="date" value={openedAt} onChange={(event) => setOpenedAt(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Previsão de conclusão</span><input type="date" value={forecastDate} onChange={(event) => setForecastDate(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Responsável / Assistência</span><input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Ex: Técnico interno" className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Custo registrado</span><input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0,00" className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label><label className="block sm:col-span-2"><span className="block text-xs font-semibold text-slate-700 mb-1">Nota fiscal em PDF</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024)) { setErrorMessage('Selecione um PDF de até 10 MB.'); event.target.value = ''; setInvoiceFile(null); return; } setErrorMessage(null); setInvoiceFile(file); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:rounded-md" />{invoiceFile && <span className="text-[11px] text-emerald-700 mt-1 block">Arquivo selecionado: {invoiceFile.name}</span>}<span className="text-[11px] text-slate-500 mt-1 block">Opcional para reparos, perdas ou baixas.</span></label><label className="block sm:col-span-2"><span className="block text-xs font-semibold text-slate-700 mb-1">Observações</span><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label><div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">Registrar chamado</button></div></form></div></div>}
    </div>
  );
};
