import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeftRight, CheckCircle2, FileText, Mail, Plus, RotateCcw, Pencil, ShieldAlert, Upload, X } from 'lucide-react';
import { AssetService } from '../services/assetService';
import { EmployeeService } from '../services/employeeService';
import { MovementService } from '../services/movementService';
import { EmailService } from '../services/emailService';
import { useConfirm } from '../components/common/ConfirmDialog';
import { Asset } from '../types/asset';
import { Employee } from '../types/employee';
import { Movement, MovementTermStatus, MovementType } from '../types/movement';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../lib/usePermission';
import { loadTermTemplates, renderTermHtml } from '../lib/termTemplate';
import { isComputer } from '../lib/assetLabels';

const getAssetDescription = (asset: Asset) => [asset.brand, asset.model].filter(Boolean).join(' ') || asset.category;

// "Enviar cópia ao funcionário" ao anexar o PDF assinado
const TermEmailOption: React.FC<{ checked: boolean; onChange: (v: boolean) => void; email: string }> = ({ checked, onChange, email }) => email
  ? <label className="flex items-center gap-2 cursor-pointer bg-blue-50 border border-blue-100 rounded-lg px-3 py-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="w-4 h-4 text-blue-600 rounded" /><Mail className="w-4 h-4 text-blue-600" /><span className="text-xs text-slate-700"><strong>Enviar cópia do termo por e-mail</strong> para {email}</span></label>
  : <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> O funcionário não tem e-mail no cadastro; a cópia não será enviada.</p>;

export const Movements: React.FC = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { profile } = useAuth();
  // RH: só consulta e imprime termos
  const { canEdit } = usePermission('movements');
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
  const [editing, setEditing] = useState<Movement | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStatus, setEditStatus] = useState<MovementTermStatus>('pendente');
  const [editNotes, setEditNotes] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editAssetIds, setEditAssetIds] = useState<string[]>([]);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // Termo assinado por e-mail (Configurações › E-mails)
  const [termEmailEnabled, setTermEmailEnabled] = useState(false);
  const [emailNewTerm, setEmailNewTerm] = useState(true);
  const [emailEditTerm, setEmailEditTerm] = useState(true);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [editEmailMsg, setEditEmailMsg] = useState<string | null>(null);

  // Botão do modal de edição: manda o PDF já salvo, sem precisar salvar nada
  const emailFromEdit = async () => {
    if (!editing) return;
    const to = employeeEmail(editing.employee_id);
    if (!to) { setEditError(`${editing.employee_name} não tem e-mail no cadastro.`); return; }
    if (!(await confirmTermEmail(editing, to))) return;
    setEditError(null);
    setEditEmailMsg(null);
    const r = await sendTermEmail(editing.id);
    if (r.ok) {
      setEditEmailMsg(r.text);
      const sentAt = new Date().toISOString();
      setEditing((current) => current && { ...current, term_emailed_at: sentAt, term_emailed_to: to });
      setMovements((list) => list.map((m) => (m.id === editing.id ? { ...m, term_emailed_at: sentAt, term_emailed_to: to } : m)));
    } else {
      setEditError(r.text.replace('O termo foi salvo, mas o e-mail não foi enviado: ', 'E-mail não enviado: '));
    }
  };

  // Pergunta antes de mandar o PDF ao funcionário
  const confirmTermEmail = (movement: Movement, to: string, fileName?: string | null, justAttached = false) => confirm({
    title: justAttached ? 'Termo anexado! Enviar cópia por e-mail?' : movement.term_emailed_at ? 'Reenviar termo por e-mail?' : 'Enviar termo por e-mail?',
    icon: <Mail className="w-5 h-5" />,
    confirmLabel: movement.term_emailed_at && !justAttached ? 'Reenviar' : 'Enviar e-mail',
    cancelLabel: justAttached ? 'Agora não' : 'Cancelar',
    message: (
      <div className="space-y-3">
        <p>O PDF do termo de {movement.type === 'entrega' ? 'entrega' : 'devolução'} assinado vai em anexo para o funcionário.</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-2"><span className="w-16 shrink-0 text-slate-500">Para</span><span className="font-semibold text-slate-800 truncate">{movement.employee_name}</span></div>
          <div className="flex items-center gap-2"><span className="w-16 shrink-0 text-slate-500">E-mail</span><span className="font-medium text-blue-700 truncate">{to}</span></div>
          <div className="flex items-center gap-2"><span className="w-16 shrink-0 text-slate-500">Anexo</span><span className="inline-flex items-center gap-1 text-slate-700 truncate"><FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />{fileName || movement.term_file_name || 'termo.pdf'}</span></div>
        </div>
        {movement.term_emailed_at && !justAttached && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">Já enviado em {new Date(movement.term_emailed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{movement.term_emailed_to ? ` para ${movement.term_emailed_to}` : ''}.</p>
        )}
      </div>
    ),
  });

  useEffect(() => {
    EmailService.getSettings().then((s) => setTermEmailEnabled(!!s?.term_email_enabled)).catch(() => setTermEmailEnabled(false));
  }, []);

  const employeeEmail = (employeeId: string) => employees.find((e) => e.id === employeeId)?.email?.trim() || '';

  // Envia o PDF assinado ao funcionário; devolve o texto para a mensagem da tela
  const sendTermEmail = async (movementId: string): Promise<{ ok: boolean; text: string }> => {
    setEmailingId(movementId);
    try {
      const r = await EmailService.sendTerm(movementId);
      return { ok: true, text: `Cópia do termo enviada para ${r.to}.` };
    } catch (error: any) {
      return { ok: false, text: `O termo foi salvo, mas o e-mail não foi enviado: ${error?.message || 'erro desconhecido'}` };
    } finally {
      setEmailingId(null);
    }
  };

  const resendTermEmail = async (movement: Movement) => {
    const to = employeeEmail(movement.employee_id);
    if (!to) { setErrorMessage(`${movement.employee_name} não tem e-mail no cadastro.`); return; }
    if (!(await confirmTermEmail(movement, to))) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    const r = await sendTermEmail(movement.id);
    if (r.ok) { setSuccessMessage(r.text.replace('Cópia do termo', `Termo de ${movement.employee_name}`)); await loadData(); } else setErrorMessage(r.text.replace('O termo foi salvo, mas o e-mail não foi enviado: ', ''));
  };

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
    () => employees.filter((employee) => movementType === 'devolucao'
      // Devolução: só quem ainda tem ativos vinculados
      ? assets.some((asset) => asset.assigned_employee_id === employee.id)
      : employee.status !== 'desligado'),
    [employees, assets, movementType],
  );

  const eligibleAssets = useMemo(() => {
    if (movementType === 'entrega') {
      return assets.filter((asset) => String(asset.status).toLowerCase() === 'disponivel');
    }
    return assets.filter((asset) => asset.assigned_employee_id === selectedEmployeeId);
  }, [assets, movementType, selectedEmployeeId]);

  useEffect(() => {
    setSelectedAssetIds([]);
  }, [movementType, selectedEmployeeId]);

  // Computador (notebook, desktop, servidor) exige termo; periféricos dispensam
  const isComputerId = (id: string) => assets.some((asset) => asset.id === id && isComputer(asset.category));
  const hasComputer = (ids: string[]) => ids.some(isComputerId);
  const newNeedsTerm = movementType === 'entrega' && hasComputer(selectedAssetIds);
  useEffect(() => {
    if (newNeedsTerm && termStatus === 'nao_utiliza') setTermStatus('pendente');
  }, [newNeedsTerm, termStatus]);

  const openMovementModal = async (type: MovementType) => {
    setMovementType(type);
    setSelectedEmployeeId('');
    setSelectedAssetIds([]);
    setMovementDate(new Date().toISOString().split('T')[0]);
    setTermStatus('pendente');
    setNotes('');
    setTermFile(null);
    setEmailNewTerm(true);
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
    if (newNeedsTerm && termStatus === 'nao_utiliza') {
      setErrorMessage('Entrega com computador exige termo.');
      return;
    }
    if (movementType === 'entrega' && termStatus === 'assinado' && !termFile) {
      setErrorMessage('Anexe o PDF do termo assinado antes de registrar a entrega.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const uploadedTerm = termFile && termStatus !== 'nao_utiliza' ? await MovementService.uploadTerm(termFile) : null;
      const saved = await MovementService.saveMovement({
        employee_id: selectedEmployeeId,
        type: movementType,
        asset_ids: selectedAssetIds,
        movement_date: movementDate,
        term_status: termStatus,
        notes: notes || null,
        term_file_path: uploadedTerm?.path || null,
        term_file_name: uploadedTerm?.name || null,
      });
      const done = movementType === 'entrega' ? 'Entrega registrada com sucesso.' : 'Devolução registrada com sucesso.';
      setIsModalOpen(false);
      if (uploadedTerm && termEmailEnabled && emailNewTerm && employeeEmail(selectedEmployeeId) && saved?.id) {
        const r = await sendTermEmail(saved.id);
        if (r.ok) setSuccessMessage(`${done} ${r.text}`); else { setSuccessMessage(done); setErrorMessage(r.text); }
      } else {
        setSuccessMessage(done);
      }
      await loadData();
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

  // Anexa o PDF assinado direto da lista, sem abrir o editor
  const attachTermFile = async (movement: Movement, file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) {
      setErrorMessage('Selecione um PDF de até 10 MB.');
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setAttachingId(movement.id);
    try {
      await MovementService.updateMovement(movement.id, { movement_date: movement.movement_date, term_status: 'assinado', notes: movement.notes, file });
      const done = `Termo assinado anexado para ${movement.employee_name}.`;
      const to = employeeEmail(movement.employee_id);
      if (termEmailEnabled && to && (await confirmTermEmail(movement, to, file.name, true))) {
        const r = await sendTermEmail(movement.id);
        if (r.ok) setSuccessMessage(`${done} ${r.text}`); else { setSuccessMessage(done); setErrorMessage(r.text); }
      } else {
        setSuccessMessage(done);
      }
      await loadData();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível anexar o termo.');
    } finally {
      setAttachingId(null);
    }
  };

  const openEditModal = (movement: Movement) => {
    setEditing(movement);
    setEditDate(movement.movement_date);
    // Entrega com computador marcada antes como "Não utiliza termo": volta a exigir termo
    setEditStatus(movement.type === 'entrega' && movement.term_status === 'nao_utiliza' && hasComputer(movement.asset_ids) ? 'pendente' : movement.term_status);
    setEditNotes(movement.notes || '');
    setEditFile(null);
    setEmailEditTerm(true);
    setEditEmailMsg(null);
    setEditError(null);
    setEditAssetIds(movement.asset_ids);
  };

  // Itens que podem aparecer na edição de uma entrega: os atuais + os disponíveis no estoque
  const editableAssets = useMemo(() => {
    if (!editing || editing.type !== 'entrega') return [];
    const current = assets.filter((asset) => editing.asset_ids.includes(asset.id));
    const available = assets.filter((asset) => !editing.asset_ids.includes(asset.id) && String(asset.status).toLowerCase() === 'disponivel');
    return [...current, ...available];
  }, [assets, editing]);

  const itemsChanged = !!editing && editing.type === 'entrega'
    && (editAssetIds.length !== editing.asset_ids.length || editAssetIds.some((id) => !editing.asset_ids.includes(id)));

  // Só a troca de computador invalida o termo assinado; trocar periféricos mantém
  const computersChanged = itemsChanged && !!editing
    && editing.asset_ids.filter(isComputerId).sort().join() !== editAssetIds.filter(isComputerId).sort().join();
  const editNeedsTerm = !!editing && editing.type === 'entrega' && hasComputer(editAssetIds);
  useEffect(() => {
    if (editNeedsTerm && editStatus === 'nao_utiliza') setEditStatus('pendente');
  }, [editNeedsTerm, editStatus]);

  // Um item da entrega que já saiu do funcionário (devolvido/transferido) não pode ser removido por aqui
  const isLockedItem = (asset: Asset) => !!editing && editing.asset_ids.includes(asset.id) && asset.assigned_employee_id !== editing.employee_id;

  const toggleEditAsset = (asset: Asset) => {
    if (isLockedItem(asset)) return;
    setEditAssetIds((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id]);
  };

  const editedMovement = (): Movement | null => {
    if (!editing) return null;
    if (!itemsChanged) return { ...editing, movement_date: editDate, notes: editNotes || null };
    const selected = assets.filter((asset) => editAssetIds.includes(asset.id));
    return {
      ...editing,
      movement_date: editDate,
      notes: editNotes || null,
      asset_ids: selected.map((asset) => asset.id),
      items: selected.map((asset) => ({ id: asset.id, patrimony: asset.patrimony, description: getAssetDescription(asset) })),
    };
  };

  const handleEditSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (itemsChanged && editAssetIds.length === 0) {
      setEditError('Selecione ao menos um ativo.');
      return;
    }
    // Computador trocado sem PDF novo: o termo antigo não vale mais
    const status = computersChanged && !editFile && editStatus !== 'nao_utiliza' ? 'pendente' : editStatus;
    if (editNeedsTerm && status === 'nao_utiliza') {
      setEditError('Entrega com computador exige termo.');
      return;
    }
    if (editing.type === 'entrega' && status === 'assinado' && !editFile && !editing.term_file_path) {
      setEditError('Anexe o PDF do termo assinado para marcar a entrega como assinada.');
      return;
    }
    setEditError(null);
    setIsSavingEdit(true);
    try {
      const newFile = status === 'nao_utiliza' ? null : editFile;
      await MovementService.updateMovement(editing.id, { movement_date: editDate, term_status: status, notes: editNotes, file: newFile, asset_ids: itemsChanged ? editAssetIds : null });
      const done = `Movimentação de ${editing.employee_name} atualizada.`;
      const movementId = editing.id;
      setEditing(null);
      if (newFile && termEmailEnabled && emailEditTerm && employeeEmail(editing.employee_id)) {
        const r = await sendTermEmail(movementId);
        if (r.ok) setSuccessMessage(`${done} ${r.text}`); else { setSuccessMessage(done); setErrorMessage(r.text); }
      } else {
        setSuccessMessage(done);
      }
      await loadData();
    } catch (error: any) {
      setEditError(error?.message || 'Não foi possível salvar a movimentação.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const printTerm = async (movement: Movement) => {
    // Abre a janela antes de carregar o modelo, para o navegador não bloquear o pop-up
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      setErrorMessage('Não foi possível abrir o termo. Verifique o bloqueador de pop-ups.');
      return;
    }
    printWindow.document.write('<p style="font-family: Arial; color: #64748b; padding: 24px">Gerando termo…</p>');

    const templates = await loadTermTemplates();
    const template = templates[movement.type === 'entrega' ? 'termo_entrega' : 'termo_devolucao'];
    const employee = employees.find((item) => item.id === movement.employee_id);
    const html = renderTermHtml(template, {
      type: movement.type,
      employee: {
        full_name: employee?.full_name || movement.employee_name,
        email: employee?.email,
        role_title: employee?.role_title,
        department: employee?.department,
        unit: employee?.unit,
        registration_number: employee?.registration_number,
        cpf: employee?.cpf,
      },
      items: movement.items,
      date: movement.movement_date,
      notes: movement.notes,
      responsible: profile?.full_name || profile?.email || '',
    });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  const statusLabel = (status: MovementTermStatus) => status === 'assinado' ? 'Termo Assinado' : status === 'nao_utiliza' ? 'Não utiliza termo' : 'Termo Pendente';

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Entregas, Empréstimos & Devoluções</h2>
          <p className="text-slate-500 text-sm mt-1">Custódia de equipamentos, movimentações em lote, geração de termos e histórico.</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          {canEdit && (<>
          <button type="button" onClick={() => openMovementModal('devolucao')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"><RotateCcw className="w-4 h-4" /> Registrar Devolução</button>
          <button type="button" onClick={() => openMovementModal('entrega')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"><Plus className="w-4 h-4" /> Nova Entrega em Lote</button>
          </>)}
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
              <td className="px-6 py-4"><span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${movement.term_status === 'assinado' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : movement.term_status === 'nao_utiliza' ? 'text-slate-600 bg-slate-50 border border-slate-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}><CheckCircle2 className="w-3.5 h-3.5" />{statusLabel(movement.term_status)}</span>{movement.term_emailed_at && <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500" title={`Enviado para ${movement.term_emailed_to || 'o funcionário'} em ${new Date(movement.term_emailed_at).toLocaleString('pt-BR')}`}><Mail className="w-3 h-3" /> Enviado por e-mail em {new Date(movement.term_emailed_at).toLocaleDateString('pt-BR')}</span>}</td>
              <td className="px-6 py-4 text-right"><div className="flex justify-end gap-1"><button type="button" onClick={() => printTerm(movement)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-50 transition-colors"><FileText className="w-4 h-4" /> Ver Termo</button>{movement.term_file_path && <button type="button" onClick={() => openTermFile(movement)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 p-1.5 rounded-md hover:bg-emerald-50 transition-colors">PDF</button>}{canEdit && termEmailEnabled && movement.term_file_path && !movement.term_file_path.startsWith('data:') && <button type="button" disabled={emailingId === movement.id} onClick={() => resendTermEmail(movement)} title={movement.term_emailed_at ? 'Reenviar o PDF ao funcionário' : 'Enviar o PDF ao funcionário'} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-700 p-1.5 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50"><Mail className="w-4 h-4" />{emailingId === movement.id ? 'Enviando…' : movement.term_emailed_at ? 'Reenviar' : 'E-mail'}</button>}{canEdit && movement.term_status === 'pendente' && <label className={`inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 p-1.5 rounded-md hover:bg-amber-50 transition-colors ${attachingId === movement.id ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}><Upload className="w-4 h-4" />{attachingId === movement.id ? 'Enviando…' : 'Inserir termo'}<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; attachTermFile(movement, file); }} /></label>}{canEdit && <button type="button" onClick={() => openEditModal(movement)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-100 transition-colors"><Pencil className="w-4 h-4" /> Editar</button>}</div></td>
            </tr>)}
            {!isLoading && movements.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500"><AlertCircle className="w-5 h-5 mx-auto mb-2 text-slate-400" />Nenhuma movimentação cadastrada.</td></tr>}
          </tbody></table></div>
      </div>

      {isModalOpen && <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"><div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4"><h3 className="text-lg font-bold text-slate-800">{movementType === 'entrega' ? 'Nova entrega de ativos' : 'Registrar devolução'}</h3><button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button></div>
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Funcionário *</span><select required value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"><option value="">Selecione um funcionário</option>{eligibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.preferential_name || employee.full_name}</option>)}</select></label><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Data *</span><input required type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label></div>
          <div><div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-slate-700">{movementType === 'entrega' ? 'Ativos disponíveis *' : 'Ativos vinculados ao funcionário *'}</span><span className="text-xs text-slate-500">{selectedAssetIds.length} selecionado(s)</span></div><div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">{eligibleAssets.length === 0 ? <div className="p-4 text-xs text-slate-500 text-center">{movementType === 'entrega' ? 'Não há ativos disponíveis.' : 'Selecione um funcionário com ativos em uso.'}</div> : eligibleAssets.map((asset) => <label key={asset.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={() => toggleAsset(asset.id)} className="w-4 h-4 text-blue-600 rounded" /><span><strong className="text-slate-800">{asset.patrimony}</strong><span className="block text-xs text-slate-500">{getAssetDescription(asset)} · {asset.unit}</span></span></label>)}</div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="flex flex-col justify-center gap-2"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={termStatus === 'assinado'} onChange={(event) => setTermStatus(event.target.checked ? 'assinado' : 'pendente')} className="w-4 h-4 text-blue-600 rounded" /><span className="text-xs font-semibold text-slate-700">Termo assinado manualmente</span></label><label className={`flex items-center gap-2 ${newNeedsTerm ? 'cursor-not-allowed' : 'cursor-pointer'}`}><input type="checkbox" disabled={newNeedsTerm} checked={termStatus === 'nao_utiliza'} onChange={(event) => { setTermStatus(event.target.checked ? 'nao_utiliza' : 'pendente'); if (event.target.checked) setTermFile(null); }} className="w-4 h-4 text-blue-600 rounded disabled:opacity-50" /><span className={`text-xs font-semibold ${newNeedsTerm ? 'text-slate-400' : 'text-slate-700'}`}>Não utiliza termo <span className="font-normal text-slate-500">{newNeedsTerm ? '(entrega com computador exige termo)' : '(periféricos, mouse…)'}</span></span></label></div><label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Observações</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label></div>
          {termStatus !== 'nao_utiliza' && <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">PDF do termo assinado{termStatus === 'assinado' ? ' *' : ''}</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024)) { setErrorMessage('Selecione um PDF de até 10 MB.'); event.target.value = ''; setTermFile(null); return; } setErrorMessage(null); setTermFile(file); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:rounded-md" />{termFile && <span className="text-[11px] text-emerald-700 mt-1 block">Arquivo selecionado: {termFile.name}</span>}<span className="text-[11px] text-slate-500 mt-1 block">Após imprimir, assine o termo e anexe o PDF aqui.</span></label>}
          {termStatus !== 'nao_utiliza' && termFile && termEmailEnabled && <TermEmailOption checked={emailNewTerm} onChange={setEmailNewTerm} email={employeeEmail(selectedEmployeeId)} />}
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" disabled={!selectedEmployeeId || selectedAssetIds.length === 0} onClick={printDraftTerm} className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold"><FileText className="w-4 h-4" /> Imprimir termo</button><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">{movementType === 'entrega' ? 'Registrar entrega' : 'Registrar devolução'}</button></div>
        </form>
      </div></div>}

      {editing && <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"><div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4"><h3 className="text-lg font-bold text-slate-800">Editar {editing.type === 'entrega' ? 'entrega' : 'devolução'}</h3><button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button></div>
        <form onSubmit={handleEditSave} className="space-y-4 text-sm">
          {editError && <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-xs">{editError}</div>}
          {editEmailMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{editEmailMsg}</div>}
          {editing.type === 'entrega' ? <div><div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-slate-700">Itens da entrega para {editing.employee_name} *</span><span className="text-xs text-slate-500">{editAssetIds.length} selecionado(s)</span></div><div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100">{editableAssets.map((asset) => { const locked = isLockedItem(asset); const isCurrent = editing.asset_ids.includes(asset.id); return <label key={asset.id} className={`flex items-center gap-2 px-3 py-2 text-xs ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}><input type="checkbox" disabled={locked} checked={editAssetIds.includes(asset.id)} onChange={() => toggleEditAsset(asset)} className="w-4 h-4 text-blue-600 rounded" /><span className="font-semibold text-slate-800">{asset.patrimony}</span><span className="text-slate-600 flex-1">{getAssetDescription(asset)}</span><span className={`text-[10px] font-semibold ${isCurrent ? 'text-blue-700' : 'text-slate-400'}`}>{locked ? 'já devolvido' : isCurrent ? 'nesta entrega' : 'disponível'}</span></label>; })}{editableAssets.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-500">Nenhum ativo disponível.</p>}</div>{computersChanged ? <p className="text-[11px] text-amber-700 mt-1">Computador alterado: os itens removidos voltam ao estoque e o termo volta a ficar pendente até você anexar o novo PDF assinado. Use "Imprimir termo" para gerar o termo com os itens novos.</p> : itemsChanged && <p className="text-[11px] text-slate-500 mt-1">Itens alterados: os removidos voltam ao estoque. Só periféricos mudaram, então a situação do termo é mantida.</p>}</div> : <div className="bg-slate-50 border border-slate-200 rounded-lg p-3"><span className="block text-xs font-semibold text-slate-800">{editing.employee_name}</span><ul className="text-xs text-slate-600 mt-1 space-y-0.5">{editing.items.map((item) => <li key={item.id}>• {item.patrimony} — {item.description}</li>)}</ul></div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Data *</span><input type="date" required value={editDate} onChange={(event) => setEditDate(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
            <div className="flex flex-col justify-center gap-2 sm:mt-5"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" disabled={computersChanged && !editFile} checked={!(computersChanged && !editFile) && editStatus === 'assinado'} onChange={(event) => setEditStatus(event.target.checked ? 'assinado' : 'pendente')} className="w-4 h-4 text-blue-600 rounded disabled:opacity-50" /><span className="text-xs font-semibold text-slate-700">Termo assinado</span></label><label className={`flex items-center gap-2 ${editNeedsTerm ? 'cursor-not-allowed' : 'cursor-pointer'}`}><input type="checkbox" disabled={editNeedsTerm} checked={editStatus === 'nao_utiliza'} onChange={(event) => { setEditStatus(event.target.checked ? 'nao_utiliza' : 'pendente'); if (event.target.checked) setEditFile(null); }} className="w-4 h-4 text-blue-600 rounded disabled:opacity-50" /><span className={`text-xs font-semibold ${editNeedsTerm ? 'text-slate-400' : 'text-slate-700'}`}>Não utiliza termo{editNeedsTerm && <span className="font-normal"> (entrega com computador exige termo)</span>}</span></label></div>
          </div>
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Observações</span><input value={editNotes} onChange={(event) => setEditNotes(event.target.value)} placeholder="Opcional" className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
          {editStatus !== 'nao_utiliza' && <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">{editing.term_file_path ? 'Substituir PDF do termo' : 'PDF do termo assinado'}</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024)) { setEditError('Selecione um PDF de até 10 MB.'); event.target.value = ''; setEditFile(null); return; } setEditError(null); setEditFile(file); if (file) setEditStatus('assinado'); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:rounded-md" />{editFile ? <span className="text-[11px] text-emerald-700 mt-1 block">Arquivo selecionado: {editFile.name}</span> : editing.term_file_path && <span className="text-[11px] text-slate-500 mt-1 block">PDF atual: {editing.term_file_name || 'termo.pdf'} (mantido se nenhum arquivo for escolhido)</span>}</label>}
          {editStatus !== 'nao_utiliza' && editFile && termEmailEnabled && <TermEmailOption checked={emailEditTerm} onChange={setEmailEditTerm} email={employeeEmail(editing.employee_id)} />}
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">{termEmailEnabled && editing.term_file_path && !editing.term_file_path.startsWith('data:') && <button type="button" onClick={emailFromEdit} disabled={!!editFile || emailingId === editing.id} title={editFile ? 'Salve primeiro: o envio usa o PDF já anexado' : editing.term_emailed_at ? `Já enviado em ${new Date(editing.term_emailed_at).toLocaleDateString('pt-BR')}` : 'Envia o PDF atual ao funcionário'} className="sm:mr-auto inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold"><Mail className="w-4 h-4" /> {emailingId === editing.id ? 'Enviando…' : editing.term_emailed_at ? 'Reenviar por e-mail' : 'Enviar por e-mail'}</button>}<button type="button" onClick={() => { const movement = editedMovement(); if (movement) printTerm(movement); }} className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg text-sm font-semibold"><FileText className="w-4 h-4" /> Imprimir termo</button><button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button><button type="submit" disabled={isSavingEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold">{isSavingEdit ? 'Salvando…' : 'Salvar'}</button></div>
        </form>
      </div></div>}
    </div>
  );
};
