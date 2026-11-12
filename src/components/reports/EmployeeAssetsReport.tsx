import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Printer, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AssetService } from '../../services/assetService';
import { EmployeeService } from '../../services/employeeService';
import { MovementService } from '../../services/movementService';
import { Asset } from '../../types/asset';
import { Employee } from '../../types/employee';
import { Movement } from '../../types/movement';
import { categoryLabel } from '../../lib/assetLabels';
import {
  buildEmployeeAssets,
  exportEmployeeAssetsExcel,
  renderEmployeeAssetsHtml,
  termLabel,
} from '../../lib/reports/employeeAssets';

const formatDate = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR') : '—');

/** Relatórios › Itens por funcionário */
export const EmployeeAssetsReport: React.FC = () => {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyWithItems, setOnlyWithItems] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [e, a, m] = await Promise.all([
          EmployeeService.getEmployees(),
          AssetService.getAssets(),
          MovementService.getMovements(),
        ]);
        setEmployees(e);
        setAssets(a);
        setMovements(m);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível carregar os dados do relatório.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const countByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) {
      if (a.assigned_employee_id && a.status !== 'baixado') map.set(a.assigned_employee_id, (map.get(a.assigned_employee_id) || 0) + 1);
    }
    return map;
  }, [assets]);

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees
      .filter((e) => !onlyWithItems || countByEmployee.has(e.id))
      .filter((e) => !term || [e.full_name, e.preferential_name, e.email, e.department].some((v) => v?.toLowerCase().includes(term)))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [employees, search, onlyWithItems, countByEmployee]);

  const selected = useMemo(() => {
    const e = employees.find((x) => x.id === selectedId);
    return e ? buildEmployeeAssets(e, assets, movements) : null;
  }, [selectedId, employees, assets, movements]);

  const generatedBy = profile?.full_name || profile?.email || '';

  const print = () => {
    if (!selected) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { setError('Não foi possível abrir a impressão. Verifique o bloqueador de pop-ups.'); return; }
    w.document.write(renderEmployeeAssetsHtml(selected, generatedBy));
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const exportExcel = async (all: boolean) => {
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      if (all) {
        const data = employees
          .filter((e) => countByEmployee.has(e.id))
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
          .map((e) => buildEmployeeAssets(e, assets, movements));
        await exportEmployeeAssetsExcel(data, `itens_por_funcionario_${date}.xlsx`);
      } else if (selected) {
        const slug = selected.employee.full_name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
        await exportEmployeeAssetsExcel([selected], `itens_${slug}_${date}.xlsx`);
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível gerar o Excel.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {countByEmployee.size} funcionários com itens · {[...countByEmployee.values()].reduce((s, n) => s + n, 0)} itens sob responsabilidade
        </p>
        <button
          type="button"
          disabled={exporting || countByEmployee.size === 0}
          onClick={() => exportExcel(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-semibold"
        >
          <FileSpreadsheet className="w-4 h-4" /> Excel de todos os funcionários
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[560px]">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar funcionário"
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={onlyWithItems} onChange={(e) => setOnlyWithItems(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              Só quem tem itens
            </label>
          </div>
          <ul className="overflow-y-auto divide-y divide-slate-100">
            {list.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(e.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 ${selectedId === e.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800 truncate">{e.preferential_name || e.full_name}</span>
                    <span className="block text-[11px] text-slate-500 truncate">{e.department}{e.status === 'desligado' ? ' · Desligado' : ''}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${countByEmployee.get(e.id) ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    {countByEmployee.get(e.id) || 0}
                  </span>
                </button>
              </li>
            ))}
            {!list.length && <li className="p-4 text-xs text-slate-500 text-center">Nenhum funcionário encontrado.</li>}
          </ul>
        </div>

        <div className="border border-slate-200 rounded-xl p-5 min-h-[300px]">
          {!selected ? (
            <p className="text-sm text-slate-500 text-center py-16">Escolha um funcionário na lista para ver os itens com ele.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold text-slate-800">{selected.employee.full_name}</h4>
                  <p className="text-xs text-slate-500">
                    {[selected.employee.role_title, selected.employee.department, selected.employee.unit].filter(Boolean).join(' · ')}
                    {selected.employee.status === 'desligado' && <span className="ml-2 text-rose-600 font-semibold">Desligado</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={print} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">
                    <Printer className="w-4 h-4" /> Imprimir / PDF
                  </button>
                  <button type="button" disabled={exporting} onClick={() => exportExcel(false)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                </div>
              </div>

              {selected.employee.status === 'desligado' && selected.items.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs">
                  Funcionário desligado ainda com {selected.items.length} {selected.items.length === 1 ? 'item' : 'itens'} — registre a devolução em Entregas & Devoluções.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Patrimônio</th>
                      <th className="text-left px-3 py-2 font-semibold">Item</th>
                      <th className="text-left px-3 py-2 font-semibold">Nº de série</th>
                      <th className="text-left px-3 py-2 font-semibold">Entregue em</th>
                      <th className="text-left px-3 py-2 font-semibold">Termo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selected.items.map((i) => (
                      <tr key={i.asset.id}>
                        <td className="px-3 py-2 font-mono text-xs">{i.asset.patrimony}</td>
                        <td className="px-3 py-2">
                          <span className="block text-slate-800">{[i.asset.brand, i.asset.model].filter(Boolean).join(' ') || categoryLabel(i.asset.category)}</span>
                          <span className="block text-[11px] text-slate-500">{categoryLabel(i.asset.category)}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{i.asset.serial_number || '—'}</td>
                        <td className="px-3 py-2 text-xs">{formatDate(i.deliveredAt)}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className={i.termStatus === 'assinado' ? 'text-emerald-700' : i.termStatus === 'pendente' ? 'text-amber-700' : 'text-slate-500'}>
                            {termLabel(i)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!selected.items.length && (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-500">Nenhum item com este funcionário.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selected.history.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold uppercase text-slate-500 mb-2">Histórico de entregas e devoluções</h5>
                  <ul className="text-xs divide-y divide-slate-100 border border-slate-100 rounded-lg">
                    {selected.history.map((m) => (
                      <li key={m.id} className="px-3 py-2 flex gap-3">
                        <span className="w-20 shrink-0 text-slate-500">{formatDate(m.movement_date)}</span>
                        <span className={`w-20 shrink-0 font-semibold ${m.type === 'entrega' ? 'text-blue-700' : 'text-emerald-700'}`}>{m.type === 'entrega' ? 'Entrega' : 'Devolução'}</span>
                        <span className="text-slate-700">{m.items.map((i) => `${i.patrimony} — ${i.description || 'Ativo'}`).join(' · ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
