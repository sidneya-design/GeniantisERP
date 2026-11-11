import React, { useEffect, useMemo, useState } from 'react';
import { Laptop, Plus, Search, QrCode, Eye, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AssetService } from '../services/assetService';
import { Asset } from '../types/asset';
import { EmployeeService } from '../services/employeeService';
import { Employee } from '../types/employee';

const EMPTY_ASSET_FORM = {
  patrimony: '',
  serial_number: '',
  category: 'notebook',
  brand: '',
  model: '',
  unit: 'Matriz - São Paulo',
  condition: 'bom' as Asset['condition'],
  status: 'disponivel' as Asset['status'],
  assigned_employee_id: '',
  warranty_until: '',
  acquisition_date: '',
  purchase_cost: '',
  notes: '',
};

export const Assets: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_ASSET_FORM });

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      const [assetData, employeeData] = await Promise.all([
        AssetService.getAssets(),
        EmployeeService.getEmployees(),
      ]);
      setAssets(assetData);
      setEmployees(employeeData);
      setErrorMessage(null);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível carregar os ativos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAssets(); }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await AssetService.saveAsset({
        ...formData,
        id: editingAsset?.id,
        serial_number: formData.serial_number || undefined,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        warranty_until: formData.warranty_until || null,
        acquisition_date: formData.acquisition_date || null,
        purchase_cost: formData.purchase_cost ? Number(formData.purchase_cost) : null,
        notes: formData.notes || null,
        assigned_employee_id: formData.assigned_employee_id || null,
      });
      await loadAssets();
      setSuccessMessage(editingAsset ? 'Ativo atualizado com sucesso.' : 'Ativo cadastrado com sucesso.');
      setIsModalOpen(false);
      setEditingAsset(null);
      setFormData({ ...EMPTY_ASSET_FORM });
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível salvar o ativo.');
    }
  };

  const handleNew = () => {
    setEditingAsset(null);
    setSelectedAsset(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFormData({ ...EMPTY_ASSET_FORM });
    setIsModalOpen(true);
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setSelectedAsset(null);
    setIsDetailsOpen(false);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFormData({
      patrimony: asset.patrimony,
      serial_number: asset.serial_number || '',
      category: asset.category,
      brand: asset.brand || '',
      model: asset.model || '',
      unit: asset.unit,
      condition: asset.condition,
      status: asset.status,
      assigned_employee_id: asset.assigned_employee_id || '',
      warranty_until: asset.warranty_until || '',
      acquisition_date: asset.acquisition_date || '',
      purchase_cost: asset.purchase_cost === null || asset.purchase_cost === undefined ? '' : String(asset.purchase_cost),
      notes: asset.notes || '',
    });
    setIsModalOpen(true);
  };

  const handlePrintLabels = () => {
    if (assets.length === 0) {
      setErrorMessage('Cadastre ao menos um ativo para imprimir etiquetas.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      setErrorMessage('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.');
      return;
    }

    const escapeHtml = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const labels = assets
      .filter((asset) => asset.status !== 'baixado')
      .map((asset) => `
        <article class="label">
          <div class="brand">GENIANTIS</div>
          <div class="code">${escapeHtml(asset.patrimony)}</div>
          <div>${escapeHtml([asset.brand, asset.model].filter(Boolean).join(' ') || asset.category)}</div>
          <div class="serial">${asset.serial_number ? `S/N: ${escapeHtml(asset.serial_number)}` : 'S/N não informado'}</div>
        </article>
      `)
      .join('');

    printWindow.document.write(`<!doctype html><html><head><title>Etiquetas de ativos</title><style>
      @page { margin: 12mm; }
      body { font-family: Arial, sans-serif; margin: 0; }
      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .label { border: 1px solid #334155; border-radius: 8px; padding: 14px; min-height: 90px; page-break-inside: avoid; }
      .brand { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #2563eb; }
      .code { font-size: 22px; font-weight: 700; margin: 8px 0 4px; }
      .serial { font-size: 10px; color: #475569; margin-top: 8px; }
    </style></head><body><div class="grid">${labels}</div></body></html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = [asset.patrimony, asset.serial_number, asset.brand, asset.model, asset.assigned_to]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
    const matchesCategory = filterCategory === 'todas' || asset.category === filterCategory;
    const matchesStatus = filterStatus === 'todos' || asset.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  }), [assets, filterCategory, filterStatus, searchTerm]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'disponivel':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Disponível</span>;
      case 'em_uso':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Em Uso</span>;
      case 'em_manutencao':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Manutenção</span>;
      case 'baixado':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Baixado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Ativos de TI</h2>
          <p className="text-slate-500 text-sm mt-1">
            Inventário corporativo de equipamentos, controle patrimonial, garantias e etiquetas com QR Code.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button type="button" onClick={handlePrintLabels} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
            <QrCode className="w-4 h-4" /> Imprimir Etiquetas
          </button>
          <button type="button" onClick={handleNew} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors">
            <Plus className="w-4 h-4" /> Novo Ativo
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por patrimônio, série ou modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="todas">Todas as Categorias</option>
            <option value="notebook">Notebook</option>
            <option value="desktop">Desktop</option>
            <option value="monitor">Monitor</option>
            <option value="celular">Celular / Tablet</option>
            <option value="rede">Equipamentos de Rede</option>
            <option value="perifericos">Periféricos</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="todos">Todas as Situações</option>
            <option value="disponivel">Disponível</option>
            <option value="em_uso">Em Uso</option>
            <option value="em_manutencao">Em Manutenção</option>
            <option value="baixado">Baixado</option>
          </select>
        </div>
      </div>

      {/* Tabela de Ativos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Patrimônio / Equipamento</th>
                <th className="px-6 py-4">Nº de Série</th>
                <th className="px-6 py-4">Responsável Atual</th>
                <th className="px-6 py-4">Local / Unidade</th>
                <th className="px-6 py-4">Garantia</th>
                <th className="px-6 py-4">Situação</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">Carregando ativos...</td></tr>
              ) : filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {asset.patrimony}
                        </span>
                        <span className="text-xs text-slate-500">
                          {asset.brand} {asset.model}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-700">
                    {asset.serial_number}
                  </td>
                  <td className="px-6 py-4">
                    {asset.assigned_to ? (
                      <span className="font-semibold text-slate-800">{asset.assigned_to}</span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Nenhum (Em estoque)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{asset.unit}</td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {asset.warranty_until ? new Date(`${asset.warranty_until}T12:00:00Z`).toLocaleDateString('pt-BR') : 'Não informado'}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(asset.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedAsset(asset);
                        setIsDetailsOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                      title="Ver Ficha e Histórico"
                    >
                      <Eye className="w-4 h-4" /> Detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredAssets.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">Nenhum ativo encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800">{editingAsset ? 'Editar ativo' : 'Cadastrar novo ativo'}</h3>
              <button type="button" onClick={() => { setIsModalOpen(false); setEditingAsset(null); }} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Patrimônio *</span><input required value={formData.patrimony} onChange={(e) => setFormData({ ...formData, patrimony: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Número de série</span><input value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Categoria *</span><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"><option value="notebook">Notebook</option><option value="desktop">Desktop</option><option value="monitor">Monitor</option><option value="celular">Celular / Tablet</option><option value="rede">Equipamento de rede</option><option value="perifericos">Periférico</option></select></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Unidade *</span><input required value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Marca</span><input value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Modelo</span><input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Condição</span><select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value as Asset['condition'] })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"><option value="excelente">Excelente</option><option value="bom">Bom</option><option value="regular">Regular</option><option value="ruim">Ruim</option></select></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Situação</span><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as Asset['status'] })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"><option value="disponivel">Disponível</option><option value="em_uso">Em Uso</option><option value="em_manutencao">Em Manutenção</option><option value="baixado">Baixado</option></select></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Responsável atual</span><select value={formData.assigned_employee_id} onChange={(e) => setFormData({ ...formData, assigned_employee_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"><option value="">Nenhum (em estoque)</option>{employees.filter((employee) => employee.status !== 'desligado').map((employee) => <option key={employee.id} value={employee.id}>{employee.preferential_name || employee.full_name}</option>)}</select></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Garantia até</span><input type="date" value={formData.warranty_until} onChange={(e) => setFormData({ ...formData, warranty_until: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Data de aquisição</span><input type="date" value={formData.acquisition_date} onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Custo de aquisição</span><input type="number" min="0" step="0.01" value={formData.purchase_cost} onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <label className="block sm:col-span-2"><span className="block text-xs font-semibold text-slate-700 mb-1">Observações</span><textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => { setIsModalOpen(false); setEditingAsset(null); }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">{editingAsset ? 'Atualizar ativo' : 'Salvar ativo'}</button></div>
            </form>
          </div>
        </div>
      )}

      {isDetailsOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedAsset.patrimony}</h3>
                  <span className="text-xs text-slate-500">{selectedAsset.brand || 'Marca não informada'} {selectedAsset.model || ''}</span>
                </div>
              </div>
              <button type="button" onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div><span className="text-slate-400 block">Categoria:</span><span className="font-semibold text-slate-800">{selectedAsset.category}</span></div>
              <div><span className="text-slate-400 block">Número de série:</span><span className="font-semibold text-slate-800">{selectedAsset.serial_number || 'Não informado'}</span></div>
              <div><span className="text-slate-400 block">Unidade:</span><span className="font-semibold text-slate-800">{selectedAsset.unit}</span></div>
              <div><span className="text-slate-400 block">Condição:</span><span className="font-semibold text-slate-800">{selectedAsset.condition}</span></div>
              <div><span className="text-slate-400 block">Responsável:</span><span className="font-semibold text-slate-800">{selectedAsset.assigned_to || 'Nenhum (em estoque)'}</span></div>
              <div><span className="text-slate-400 block">Situação:</span><span className="mt-1 inline-block">{getStatusBadge(selectedAsset.status)}</span></div>
              <div><span className="text-slate-400 block">Garantia até:</span><span className="font-semibold text-slate-800">{selectedAsset.warranty_until ? new Date(`${selectedAsset.warranty_until}T12:00:00Z`).toLocaleDateString('pt-BR') : 'Não informado'}</span></div>
              <div><span className="text-slate-400 block">Aquisição:</span><span className="font-semibold text-slate-800">{selectedAsset.acquisition_date ? new Date(`${selectedAsset.acquisition_date}T12:00:00Z`).toLocaleDateString('pt-BR') : 'Não informado'}</span></div>
              <div className="col-span-2"><span className="text-slate-400 block">Observações:</span><span className="font-semibold text-slate-800">{selectedAsset.notes || 'Nenhuma observação'}</span></div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => handleEdit(selectedAsset)} className="mr-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">Editar ativo</button>
              <button type="button" onClick={() => setIsDetailsOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

