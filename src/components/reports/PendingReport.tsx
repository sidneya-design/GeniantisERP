import React, { useMemo } from 'react';
import { AssetService } from '../../services/assetService';
import { EmployeeService } from '../../services/employeeService';
import { MovementService } from '../../services/movementService';
import { Asset } from '../../types/asset';
import { Employee } from '../../types/employee';
import { Movement } from '../../types/movement';
import { categoryLabel } from '../../lib/assetLabels';
import { ReportColumn, ReportSection } from '../../lib/reports/tableReport';
import { ReportActions, ReportError, ReportLoading, ReportTable, StatCards, useReportData } from './ReportKit';

const describe = (a: Asset) => [a.brand, a.model].filter(Boolean).join(' ') || categoryLabel(a.category);

interface TermRow { movement: Movement; problem: string }
interface HolderRow { employee: Employee; asset: Asset }
interface NoDeliveryRow { asset: Asset }

const TERM_COLUMNS: ReportColumn<TermRow>[] = [
  { header: 'Data', value: (r) => r.movement.movement_date, kind: 'date', width: 12 },
  { header: 'Tipo', value: (r) => (r.movement.type === 'entrega' ? 'Entrega' : 'Devolução'), width: 11 },
  { header: 'Funcionário', value: (r) => r.movement.employee_name, width: 28 },
  { header: 'Itens', value: (r) => r.movement.items.map((i) => `${i.patrimony} — ${i.description || 'Ativo'}`).join('\n'), width: 40 },
  { header: 'Pendência', value: (r) => r.problem, width: 26 },
];

const HOLDER_COLUMNS: ReportColumn<HolderRow>[] = [
  { header: 'Funcionário', value: (r) => r.employee.full_name, width: 28 },
  { header: 'Desligado em', value: (r) => r.employee.termination_date || null, kind: 'date', width: 13 },
  { header: 'Patrimônio', value: (r) => r.asset.patrimony, mono: true, width: 12 },
  { header: 'Item', value: (r) => describe(r.asset), width: 28 },
  { header: 'Nº de série', value: (r) => r.asset.serial_number, mono: true, width: 18 },
];

const NO_DELIVERY_COLUMNS: ReportColumn<NoDeliveryRow>[] = [
  { header: 'Patrimônio', value: (r) => r.asset.patrimony, mono: true, width: 12 },
  { header: 'Item', value: (r) => describe(r.asset), width: 28 },
  { header: 'Responsável', value: (r) => r.asset.assigned_to, width: 28 },
  { header: 'Unidade', value: (r) => r.asset.unit, width: 22 },
];

/** Relatórios › Pendências de entregas e termos */
export const PendingReport: React.FC = () => {
  const { data, error, loading } = useReportData(async () => {
    const [movements, assets, employees] = await Promise.all([
      MovementService.getMovements(),
      AssetService.getAssets(),
      EmployeeService.getEmployees(),
    ]);
    return { movements, assets, employees };
  });

  const sections = useMemo(() => {
    if (!data) return null;
    const { movements, assets, employees } = data;
    const byId = new Map(employees.map((e) => [e.id, e]));
    const held = assets.filter((a) => a.assigned_employee_id && a.status !== 'baixado');

    const terms: TermRow[] = movements
      .map((m) => ({
        movement: m,
        problem: m.term_status !== 'assinado' ? 'Termo não assinado' : !m.term_file_path ? 'Assinado, sem PDF anexado' : '',
      }))
      .filter((r) => r.problem)
      .sort((a, b) => a.movement.movement_date.localeCompare(b.movement.movement_date));

    const holders: HolderRow[] = held
      .map((asset) => ({ asset, employee: byId.get(asset.assigned_employee_id as string) as Employee }))
      .filter((r) => r.employee?.status === 'desligado')
      .sort((a, b) => a.employee.full_name.localeCompare(b.employee.full_name));

    const noDelivery: NoDeliveryRow[] = held
      .filter((asset) => !movements.some((m) => m.type === 'entrega' && m.employee_id === asset.assigned_employee_id && m.asset_ids.includes(asset.id)))
      .map((asset) => ({ asset }))
      .sort((a, b) => a.asset.patrimony.localeCompare(b.asset.patrimony));

    return {
      terms: { title: 'Termos pendentes', columns: TERM_COLUMNS, rows: terms, empty: 'Todos os termos estão assinados e com PDF.' } as ReportSection<TermRow>,
      holders: { title: 'Desligados com itens', columns: HOLDER_COLUMNS, rows: holders, empty: 'Nenhum funcionário desligado com itens.' } as ReportSection<HolderRow>,
      noDelivery: { title: 'Em uso sem entrega registrada', columns: NO_DELIVERY_COLUMNS, rows: noDelivery, empty: 'Todo ativo em uso tem entrega registrada.' } as ReportSection<NoDeliveryRow>,
    };
  }, [data]);

  if (loading) return <ReportLoading />;
  if (error || !sections) return <ReportError message={error || 'Erro ao montar o relatório.'} />;

  const list = [sections.holders, sections.terms, sections.noDelivery];

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <p className="text-xs text-slate-500 max-w-xl">
          O que precisa de ação: equipamentos com quem já saiu, termos sem assinatura ou sem PDF e ativos que estão com alguém
          sem entrega registrada (sem termo).
        </p>
        <ReportActions title="Pendências de entregas e termos" fileSlug="pendencias" sections={list} landscape />
      </div>

      <StatCards items={[
        { label: 'itens com desligados', value: sections.holders.rows.length, tone: sections.holders.rows.length ? 'rose' : 'slate' },
        { label: 'termos pendentes', value: sections.terms.rows.length, tone: sections.terms.rows.length ? 'amber' : 'slate' },
        { label: 'em uso sem entrega', value: sections.noDelivery.rows.length, tone: sections.noDelivery.rows.length ? 'amber' : 'slate' },
        { label: 'total de pendências', value: list.reduce((s, x) => s + x.rows.length, 0), tone: 'blue' },
      ]} />

      {list.map((s) => <ReportTable key={s.title} section={s} />)}
    </div>
  );
};
