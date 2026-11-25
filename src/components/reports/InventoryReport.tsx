import React, { useMemo, useState } from 'react';
import { AssetService } from '../../services/assetService';
import { Asset } from '../../types/asset';
import { ASSET_CATEGORY_LABEL, ASSET_STATUS_LABEL, categoryLabel, isComputer } from '../../lib/assetLabels';
import { brl, ReportColumn, ReportSection } from '../../lib/reports/tableReport';
import { Field, FilterBar, inputCls, ReportActions, ReportError, ReportLoading, ReportTable, StatCards, useReportData } from './ReportKit';

const CONDITION_LABEL: Record<string, string> = { excelente: 'Excelente', bom: 'Bom', regular: 'Regular', ruim: 'Ruim' };

const COLUMNS: ReportColumn<Asset>[] = [
  { header: 'Patrimônio', value: (a) => a.patrimony, mono: true, width: 12 },
  { header: 'Item', value: (a) => [a.brand, a.model].filter(Boolean).join(' ') || categoryLabel(a.category), width: 28 },
  { header: 'Categoria', value: (a) => categoryLabel(a.category), width: 18 },
  { header: 'Nº de série', value: (a) => a.serial_number, mono: true, width: 18 },
  { header: 'Unidade', value: (a) => a.unit, width: 22 },
  { header: 'Situação', value: (a) => ASSET_STATUS_LABEL[a.status] || a.status, width: 14 },
  { header: 'Condição', value: (a) => CONDITION_LABEL[a.condition] || a.condition, width: 11 },
  { header: 'Responsável', value: (a) => a.assigned_to, width: 26 },
  { header: 'Aquisição', value: (a) => a.acquisition_date, kind: 'date', width: 12 },
  { header: 'Custo', value: (a) => a.purchase_cost ?? null, kind: 'money', width: 13 },
  { header: 'Garantia até', value: (a) => a.warranty_until, kind: 'date', width: 12 },
];

// Só entram quando o filtro é de computadores (ou todas as categorias, no Excel)
const COMPUTER_COLUMNS: ReportColumn<Asset>[] = [
  { header: 'Hostname', value: (a) => a.hostname, mono: true, width: 16 },
  { header: 'Sistema operacional', value: (a) => a.operating_system, width: 18 },
  { header: 'Processador', value: (a) => a.processor, width: 24 },
  { header: 'Memória', value: (a) => a.memory, width: 10 },
];

/** Relatórios › Inventário de ativos */
export const InventoryReport: React.FC = () => {
  const { data: assets, error, loading } = useReportData(() => AssetService.getAssets());
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [unit, setUnit] = useState('');
  const [search, setSearch] = useState('');

  const units = useMemo(() => [...new Set((assets || []).map((a) => a.unit).filter(Boolean))].sort(), [assets]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (assets || [])
      .filter((a) => !category || a.category === category)
      .filter((a) => !status || a.status === status)
      .filter((a) => !unit || a.unit === unit)
      .filter((a) => !q || [a.patrimony, a.serial_number, a.brand, a.model, a.assigned_to, a.notes, a.hostname, a.processor, a.operating_system].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => a.patrimony.localeCompare(b.patrimony));
  }, [assets, category, status, unit, search]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError message={error} />;

  const total = rows.reduce((s, a) => s + (a.purchase_cost || 0), 0);
  const count = (st: string) => rows.filter((a) => a.status === st).length;
  const showSpecs = !category || isComputer(category);
  const section: ReportSection<Asset> = {
    title: 'Inventário de ativos',
    columns: showSpecs ? [...COLUMNS.slice(0, 4), ...COMPUTER_COLUMNS, ...COLUMNS.slice(4)] : COLUMNS,
    rows,
    footer: `${rows.length} ativos · custo de aquisição registrado: ${brl(total)}`,
    empty: 'Nenhum ativo com esses filtros.',
  };
  const subtitle = [
    category && `Categoria: ${categoryLabel(category)}`,
    status && `Situação: ${ASSET_STATUS_LABEL[status]}`,
    unit && `Unidade: ${unit}`,
    search && `Busca: "${search}"`,
  ].filter(Boolean).join(' · ') || 'Todos os ativos';

  return (
    <div className="space-y-4">
      <FilterBar>
        <Field label="Categoria">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {Object.entries(ASSET_CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Situação">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {Object.entries(ASSET_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Unidade">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Buscar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patrimônio, série, hostname, modelo, responsável" className={`${inputCls} w-64`} />
        </Field>
        <div className="ml-auto"><ReportActions title="Inventário de ativos" subtitle={subtitle} fileSlug="inventario_ativos" sections={[section]} landscape /></div>
      </FilterBar>

      <StatCards items={[
        { label: 'ativos', value: rows.length, tone: 'blue' },
        { label: 'em uso', value: count('em_uso'), tone: 'emerald' },
        { label: 'disponíveis', value: count('disponivel') },
        { label: 'em manutenção / baixados', value: `${count('em_manutencao')} / ${count('baixado')}`, tone: 'amber' },
      ]} />

      <ReportTable section={section} showTitle={false} />
    </div>
  );
};
