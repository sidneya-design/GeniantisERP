import React, { useMemo, useState } from 'react';
import { AssetService } from '../../services/assetService';
import { Asset } from '../../types/asset';
import { ASSET_STATUS_LABEL, categoryLabel } from '../../lib/assetLabels';
import { daysUntil, ReportColumn, ReportSection } from '../../lib/reports/tableReport';
import { Field, FilterBar, inputCls, ReportActions, ReportError, ReportLoading, ReportTable, StatCards, useReportData } from './ReportKit';

type Row = Asset & { days: number };

const COLUMNS: ReportColumn<Row>[] = [
  { header: 'Garantia até', value: (a) => a.warranty_until, kind: 'date', width: 12 },
  { header: 'Situação da garantia', value: (a) => (a.days < 0 ? `Vencida há ${-a.days} dia(s)` : a.days === 0 ? 'Vence hoje' : `Vence em ${a.days} dia(s)`), width: 22 },
  { header: 'Patrimônio', value: (a) => a.patrimony, mono: true, width: 12 },
  { header: 'Item', value: (a) => [a.brand, a.model].filter(Boolean).join(' ') || categoryLabel(a.category), width: 28 },
  { header: 'Nº de série', value: (a) => a.serial_number, mono: true, width: 18 },
  { header: 'Situação do ativo', value: (a) => ASSET_STATUS_LABEL[a.status] || a.status, width: 14 },
  { header: 'Responsável', value: (a) => a.assigned_to, width: 26 },
  { header: 'Unidade', value: (a) => a.unit, width: 22 },
];

/** Relatórios › Garantias vencendo */
export const WarrantyReport: React.FC = () => {
  const { data: assets, error, loading } = useReportData(() => AssetService.getAssets());
  const [horizon, setHorizon] = useState(90);
  const [includeExpired, setIncludeExpired] = useState(false);

  const all = useMemo(
    () => (assets || [])
      .filter((a) => a.warranty_until && a.status !== 'baixado')
      .map((a) => ({ ...a, days: daysUntil(a.warranty_until as string) }))
      .sort((a, b) => a.days - b.days),
    [assets],
  );
  const rows = all.filter((a) => a.days <= horizon && (includeExpired || a.days >= 0));

  if (loading) return <ReportLoading />;
  if (error) return <ReportError message={error} />;

  const noWarranty = (assets || []).filter((a) => !a.warranty_until && a.status !== 'baixado').length;
  const section: ReportSection<Row> = {
    title: 'Garantias vencendo',
    columns: COLUMNS,
    rows,
    empty: `Nenhuma garantia vencendo nos próximos ${horizon} dias.`,
  };

  return (
    <div className="space-y-4">
      <FilterBar>
        <Field label="Vencendo nos próximos">
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className={inputCls}>
            {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} dias</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pb-1.5">
          <input type="checkbox" checked={includeExpired} onChange={(e) => setIncludeExpired(e.target.checked)} className="w-4 h-4 rounded" />
          Incluir garantias já vencidas
        </label>
        <div className="ml-auto">
          <ReportActions
            title="Garantias vencendo"
            subtitle={`Próximos ${horizon} dias${includeExpired ? ', incluindo vencidas' : ''} · ativos baixados não entram`}
            fileSlug="garantias_vencendo"
            sections={[section]}
            landscape
          />
        </div>
      </FilterBar>

      <StatCards items={[
        { label: 'vencem em 30 dias', value: all.filter((a) => a.days >= 0 && a.days <= 30).length, tone: 'rose' },
        { label: 'vencem em 90 dias', value: all.filter((a) => a.days >= 0 && a.days <= 90).length, tone: 'amber' },
        { label: 'já vencidas', value: all.filter((a) => a.days < 0).length },
        { label: 'sem garantia informada', value: noWarranty },
      ]} />

      <ReportTable section={section} showTitle={false} />
    </div>
  );
};
