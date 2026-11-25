import React, { useMemo, useState } from 'react';
import { MaintenanceService } from '../../services/maintenanceService';
import { Maintenance } from '../../types/maintenance';
import { brl, ReportColumn, ReportSection, todayISO } from '../../lib/reports/tableReport';
import { Field, FilterBar, inputCls, ReportActions, ReportError, ReportLoading, ReportTable, StatCards, useReportData } from './ReportKit';

const STATUS_LABEL: Record<string, string> = {
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  baixado: 'Baixa por perda',
};

const COLUMNS: ReportColumn<Maintenance>[] = [
  { header: 'Abertura', value: (m) => m.opened_at, kind: 'date', width: 12 },
  { header: 'Conclusão', value: (m) => m.completed_at, kind: 'date', width: 12 },
  { header: 'Patrimônio', value: (m) => m.patrimony, mono: true, width: 12 },
  { header: 'Equipamento', value: (m) => m.equipment, width: 26 },
  { header: 'Defeito', value: (m) => m.issue, width: 36 },
  { header: 'Assistência', value: (m) => m.provider, width: 20 },
  { header: 'Situação', value: (m) => STATUS_LABEL[m.status] || m.status, width: 14 },
  { header: 'Custo', value: (m) => m.cost ?? null, kind: 'money', width: 13 },
];

interface RankRow { patrimony: string; equipment: string; count: number; cost: number; last: string }

const RANK_COLUMNS: ReportColumn<RankRow>[] = [
  { header: 'Patrimônio', value: (r) => r.patrimony, mono: true, width: 12 },
  { header: 'Equipamento', value: (r) => r.equipment, width: 28 },
  { header: 'Chamados', value: (r) => r.count, kind: 'number', width: 10 },
  { header: 'Custo total', value: (r) => r.cost, kind: 'money', width: 14 },
  { header: 'Último chamado', value: (r) => r.last, kind: 'date', width: 14 },
];

/** Relatórios › Manutenções por período */
export const MaintenanceReport: React.FC = () => {
  const { data: all, error, loading } = useReportData(() => MaintenanceService.getMaintenances());
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayISO());
  const [status, setStatus] = useState('');

  const rows = useMemo(
    () => (all || [])
      .filter((m) => (!from || m.opened_at >= from) && (!to || m.opened_at <= to))
      .filter((m) => !status || m.status === status)
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at)),
    [all, from, to, status],
  );

  const ranking = useMemo(() => {
    const map = new Map<string, RankRow>();
    for (const m of rows) {
      const r = map.get(m.asset_id) || { patrimony: m.patrimony, equipment: m.equipment, count: 0, cost: 0, last: m.opened_at };
      r.count += 1;
      r.cost += m.cost || 0;
      if (m.opened_at > r.last) r.last = m.opened_at;
      map.set(m.asset_id, r);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.cost - a.cost);
  }, [rows]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError message={error} />;

  const total = rows.reduce((s, m) => s + (m.cost || 0), 0);
  const period = `${from ? from.split('-').reverse().join('/') : 'início'} a ${to ? to.split('-').reverse().join('/') : 'hoje'}`;
  const main: ReportSection<Maintenance> = {
    title: 'Chamados de manutenção',
    columns: COLUMNS,
    rows,
    footer: `${rows.length} chamados · custo total: ${brl(total)}`,
    empty: 'Nenhum chamado no período.',
  };
  const rank: ReportSection<RankRow> = {
    title: 'Equipamentos com mais chamados',
    columns: RANK_COLUMNS,
    rows: ranking,
    empty: 'Nenhum chamado no período.',
  };

  return (
    <div className="space-y-4">
      <FilterBar>
        <Field label="Aberto de"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
        <Field label="até"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
        <Field label="Situação">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <div className="ml-auto">
          <ReportActions
            title="Manutenções por período"
            subtitle={`Chamados abertos de ${period}${status ? ` · ${STATUS_LABEL[status]}` : ''}`}
            fileSlug="manutencoes"
            sections={[main, rank]}
            landscape
          />
        </div>
      </FilterBar>

      <StatCards items={[
        { label: 'chamados', value: rows.length, tone: 'blue' },
        { label: 'custo no período', value: brl(total), tone: 'amber' },
        { label: 'em andamento', value: rows.filter((m) => m.status === 'em_andamento').length },
        { label: 'equipamentos com 2+ chamados', value: ranking.filter((r) => r.count > 1).length, tone: 'rose' },
      ]} />

      <ReportTable section={rank} />
      <ReportTable section={main} />
    </div>
  );
};
