import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeftRight, CheckCircle2, FileText, Plus, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { AssetService } from '../services/assetService';
import { EmployeeService } from '../services/employeeService';
import { MovementService } from '../services/movementService';
import { Asset } from '../types/asset';
import { Employee } from '../types/employee';
import { Movement, MovementTermStatus, MovementType } from '../types/movement';

const getAssetDescription = (asset: Asset) => [asset.brand, asset.model].filter(Boolean).join(' ') || asset.category;

export const Movements: React.FC = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>('entrega');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [movementDate, setMovementDate] = useState(new Date().toISOString().split('T')[0]);
  const [termStatus, setTermStatus] = useState<MovementTermStatus>('pendente');
  const [notes, setNotes] = useState('');
  const [termFile, setTermFile] = useState<File | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [movementResult, assetResult, employeeResult] = await Promise.allSettled([
        MovementService.getMovements(),
        AssetService.getAssets(),
        EmployeeService.getEmployees(),
      ]);

      if (assetResult.status === 'rejected') {
        throw assetResult.reason;
      }
      if (employeeResult.status === 'rejected') {
        throw employeeResult.reason;
      }

      setAssets(assetResult.value);
      setEmployees(employeeResult.value);

      if (movementResult.status === 'fulfilled') {
        setMovements(movementResult.value);
        setErrorMessage(null);
      } else {
        setMovements([]);
        setErrorMessage(`Não foi possível carregar o histórico de movimentações: ${movementResult.reason?.message || 'verifique a migration do módulo.'}`);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível carregar as movimentações.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const eligibleEmployees = useMemo(
    () => employees.filter((employee) => movementType === 'devolucao' || employee.status !== 'desligado'),
    [employees, movementType],
  );

  const eligibleAssets = useMemo(() => {
    if (movementType === 'entrega') {
      return assets.filter((asset) => String(asset.status).toLowerCase() === 'disponivel');
    }
    return assets.filter((asset) => asset.status === 'em_uso' && asset.assigned_employee_id === selectedEmployeeId);
  }, [assets, movementType, selectedEmployeeId]);

  useEffect(() => {
    setSelectedAssetIds([]);
  }, [movementType, selectedEmployeeId]);

  const openMovementModal = async (type: MovementType) => {
    setMovementType(type);
    setSelectedEmployeeId('');
    setSelectedAssetIds([]);
    setMovementDate(new Date().toISOString().split('T')[0]);
    setTermStatus('pendente');
    setNotes('');
    setTermFile(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
    await loadData();
  };

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((current) => current.includes(assetId)
      ? current.filter((id) => id !== assetId)
      : [...current, assetId]);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployeeId || selectedAssetIds.length === 0) {
      setErrorMessage('Selecione um funcionário e ao menos um ativo.');
      return;
    }
    if (movementType === 'entrega' && termStatus === 'assinado' && !termFile) {
      setErrorMessage('Anexe o PDF do termo assinado antes de registrar a entrega.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const uploadedTerm = termFile ? await MovementService.uploadTerm(termFile) : null;
      await MovementService.saveMovement({
        employee_id: selectedEmployeeId,
        type: movementType,
        asset_ids: selectedAssetIds,
        movement_date: movementDate,
        term_status: termStatus,
        notes: notes || null,
        term_file_path: uploadedTerm?.path || null,
        term_file_name: uploadedTerm?.name || null,
      });
      await loadData();
      setIsModalOpen(false);
      setSuccessMessage(movementType === 'entrega' ? 'Entrega registrada com sucesso.' : 'Devolução registrada com sucesso.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível registrar a movimentação.');
    }
  };

  const printDraftTerm = () => {
    const employee = employees.find((item) => item.id === selectedEmployeeId);
    const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));
    if (!employee || selectedAssets.length === 0) {
      setErrorMessage('Selecione um funcionário e ao menos um ativo antes de imprimir o termo.');
      return;
    }

    printTerm({
      id: 'draft',
      employee_id: employee.id,
      employee_name: employee.preferential_name || employee.full_name,
      type: movementType,
      asset_ids: selectedAssets.map((asset) => asset.id),
      items: selectedAssets.map((asset) => ({ id: asset.id, patrimony: asset.patrimony, description: getAssetDescription(asset) })),
      movement_date: movementDate,
      term_status: 'pendente',
      notes: notes || null,
      user_in_charge: null,
      created_at: new Date().toISOString(),
    });
  };

  const openTermFile = async (movement: Movement) => {
    if (!movement.term_file_path) return;
    try {
      const url = await MovementService.getTermUrl(movement.term_file_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível abrir o PDF do termo.');
    }
  };

  const printTerm = (movement: Movement) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      setErrorMessage('Não foi possível abrir o termo. Verifique o bloqueador de pop-ups.');
      return;
    }

    const escapeHtml = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    const items = movement.items.map((item) => `<li><strong>${escapeHtml(item.patrimony)}</strong> — ${escapeHtml(item.description || 'Ativo')}</li>`).join('');

    printWindow.document.write(`<!doctype html><html><head><title>Termo de ${movement.type === 'entrega' ? 'entrega' : 'devolução'}</title><style>
      body { font-family: Arial, sans-serif; color: #1e293b; max-width: 800px; margin: 40px auto; line-height: 1.5; }
      h1 { font-size: 22px; text-align: center; } h2 { font-size: 16px; margin-top: 28px; }
      .meta { border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; } li { margin: 8px 0; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 80px; text-align: center; }
      .line { border-top: 1px solid #334155; padding-top: 8px; }
    </style></head><body>
      <h1>TERMO DE ${movement.type === 'entrega' ? 'ENTREGA E RESPONSABILIDADE' : 'DEVOLUÇÃO DE ATIVOS'}</h1>
      <div class="meta"><strong>Funcionário:</strong> ${escapeHtml(movement.employee_name)}<br><strong>Data:</strong> ${new Date(`${movement.movement_date}T12:00:00Z`).toLocaleDateString('pt-BR')}<br><strong>Status do termo:</strong> ${movement.term_status === 'assinado' ? 'Assinado' : 'Pendente'}</div>
      <h2>Ativos relacionados</h2><ul>${items}</ul>
      ${movement.notes ? `<h2>Observações</h2><p>${escapeHtml(movement.notes)}</p>` : ''}
      <p>Declaro estar ciente das responsabilidades relacionadas aos ativos descritos neste termo.</p>
      <div class="signatures"><div class="line">Funcionário</div><div class="line">Responsável pela movimentação</div></div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  const statusLabel = (status: MovementTermStatus) => status === 'assinado' ? 'Termo Assinado' : 'Termo Pendente';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Entregas, Empréstimos & Devoluções</h2>
          <p className="text-slate-500 text-sm mt-1">Custódia de equipamentos, movimentações em lote, geração de termos e histórico.</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button type="button" onClick={() => openMovementModal('devolucao')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"><RotateCcw className="w-4 h-4" /> Registrar Devolução</button>
          <button type="button" onClick={() => openMovementModal('entrega')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"><Plus className="w-4 h-4" /> Nova Entrega em Lote</button>
        </div>
      </div>

      {errorMessage && <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2"><ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" /><span>{errorMessage}</span></div>}
      {successMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2"><CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /><span>{successMessage}</span></div>}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" /><div className="space-y-1"><span className="font-semibold block">Regras de integridade:</span><p className="text-blue-800">Entregas utilizam apenas ativos disponíveis. Devoluções utilizam apenas ativos vinculados ao funcionário selecionado e devolvem o equipamento ao estoque.</p></div></div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between"><h3 className="font-bold text-slate-800 flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-blue-600" />Histórico de Movimentações</h3><span className="text-xs text-slate-500">{movements.length} registro(s)</span></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-600"><thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500"><tr><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Funcionário</th><th className="px-6 py-4">Itens</th><th className="px-6 py-4">Data</th><th className="px-6 py-4">Termo</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Carregando movimentações...</td></tr> : movements.map((movement) => <tr key={movement.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${movement.type === 'entrega' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{movement.type === 'entrega' ? 'Entrega / Empréstimo' : 'Devolução'}</span></td>
              <td className="px-6 py-4 font-semibold text-slate-800">{movement.employee_name}</td>
              <td className="px-6 py-4"><ul className="text-xs space-y-0.5 text-slate-700">{movement.items.map((item) => <li key={item.id}>• {item.patrimony} — {item.description}</li>)}</ul></td>
              <td className="px-6 py-4 text-xs text-slate-600">{new Date(`${movement.movement_date}T12:00:00Z`).toLocaleDateString('pt-BR')}</td>
              <td className="px-6 py-4"><span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${movement.term_status === 'assinado' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}><CheckCircle2 className="w-3.5 h-3.5" />{statusLabel(movement.term_status)}</span></td>
              <td className="px-6 py-4 text-right"><div className="flex justify-end gap-1"><button type="button" onClick={() => printTerm(movement)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-50 transition-colors"><FileText className="w-4 h-4" /> Ver Termo</button>{movement.term_file_path && <button type="button" onClick={() => openTermFile(movement)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 p-1.5 rounded-md hover:bg-emerald-50 transition-colors">PDF</button>}</div></td>
            </tr>)}
            {!isLoading && movements.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500"><AlertCircle className="w-5 h-5 mx-auto mb-2 text-slate-400" />Nenhuma movimentação cadastrada.</td></tr>}
          </tbody></table></div>
      </div>

      {isModalOpen && <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"><div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4"><h3 className="text-lg font-bold text-slate-800">{movementType === 'entrega' ? 'Nova entrega de ativos' : 'Registrar devolução'}</h3><button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button></div>
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Funcionário *</span><select required value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"><option value="">Selecione um funcionário</option>{eligibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.preferential_name || employee.full_name}</option>)}</select></label><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Data *</span><input required type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label></div>
          <div><div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-slate-700">{movementType === 'entrega' ? 'Ativos disponíveis *' : 'Ativos vinculados ao funcionário *'}</span><span className="text-xs text-slate-500">{selectedAssetIds.length} selecionado(s)</span></div><div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">{eligibleAssets.length === 0 ? <div className="p-4 text-xs text-slate-500 text-center">{movementType === 'entrega' ? 'Não há ativos disponíveis.' : 'Selecione um funcionário com ativos em uso.'}</div> : eligibleAssets.map((asset) => <label key={asset.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={() => toggleAsset(asset.id)} className="w-4 h-4 text-blue-600 rounded" /><span><strong className="text-slate-800">{asset.patrimony}</strong><span className="block text-xs text-slate-500">{getAssetDescription(asset)} · {asset.unit}</span></span></label>)}</div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="flex items-center gap-2 min-h-10 cursor-pointer"><input type="checkbox" checked={termStatus === 'assinado'} onChange={(event) => setTermStatus(event.target.checked ? 'assinado' : 'pendente')} className="w-4 h-4 text-blue-600 rounded" /><span className="text-xs font-semibold text-slate-700">Termo assinado manualmente</span></label><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Observações</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label></div>
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">PDF do termo assinado{termStatus === 'assinado' ? ' *' : ''}</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024)) { setErrorMessage('Selecione um PDF de até 10 MB.'); event.target.value = ''; setTermFile(null); return; } setErrorMessage(null); setTermFile(file); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:rounded-md" />{termFile && <span className="text-[11px] text-emerald-700 mt-1 block">Arquivo selecionado: {termFile.name}</span>}<span className="text-[11px] text-slate-500 mt-1 block">Após imprimir, assine o termo e anexe o PDF aqui.</span></label>
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" disabled={!selectedEmployeeId || selectedAssetIds.length === 0} onClick={printDraftTerm} className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold"><FileText className="w-4 h-4" /> Imprimir termo</button><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">{movementType === 'entrega' ? 'Registrar entrega' : 'Registrar devolução'}</button></div>
        </form>
      </div></div>}
    </div>
  );
};
