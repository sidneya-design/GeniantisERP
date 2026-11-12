import React, { useMemo, useState } from 'react';
import { monthlyCost, SubscriptionService } from '../../services/subscriptionService';
import { Subscription, SubscriptionAssignment } from '../../types/subscription';
import { brl, ReportColumn, ReportSection } from '../../lib/reports/tableReport';
import { Field, FilterBar, inputCls, ReportActions, ReportError, ReportLoading, ReportTable, StatCards, useReportData } from './ReportKit';

interface Row { a: SubscriptionAssignment; s: Subscription | undefined; perLicense: number | null }

const EMP_STATUS: Record<string, string> = { ativo: 'Ativo', afastado: 'Afastado', desligado: 'Desligado' };

const COLUMNS: ReportColumn<Row>[] = [
  { header: 'Funcionário', value: (r) => r.a.employee_name, width: 28 },
  { header: 'E-mail', value: (r) => r.a.employee_email, width: 30 },
  { header: 'Departamento', value: (r) => r.a.employee_department, width: 16 },
  { header: 'Situação', value: (r) => EMP_STATUS[r.a.employee_status || ''] || r.a.employee_status, width: 12 },
  { header: 'Serviço', value: (r) => r.s?.service_name || '—', width: 24 },
  { header: 'Atribuída em', value: (r) => r.a.assigned_at, kind: 'date', width: 13 },
  { header: 'Custo mensal por licença (estimado)', value: (r) => r.perLicense, kind: 'money', width: 18 },
];

/** Custo mensal de uma licença: custo mensal do serviço ÷ licenças contratadas */
function perLicense(s: Subscription | undefined): number | null {
  if (!s || s.status !== 'ativa') return null;
  const total = monthlyCost(s);
  return s.total_licenses > 0 ? Math.round((total / s.total_licenses) * 100) / 100 : null;
}

/** Relatórios › Licenças por funcionário */
export const LicensesReport: React.FC = () => {
  const { data, error, loading } = useReportData(async () => {
    const [subs, assignments] = await Promise.all([SubscriptionService.list(), SubscriptionService.listAssignments()]);
    return { subs, assignments };
  });
  const [service, setService] = useState('');
  const [search, setSearch] = useState('');
  const [onlyTerminated, setOnlyTerminated] = useState(false);

  const all = useMemo<Row[]>(() => {
    if (!data) return [];
    const byId = new Map(data.subs.map((s) => [s.id, s]));
    return data.assignments
      .map((a) => { const s = byId.get(a.subscription_id); return { a, s, perLicense: perLicense(s) }; })
      .sort((x, y) => x.a.employee_name.localeCompare(y.a.employee_name) || (x.s?.service_name || '').localeCompare(y.s?.service_name || ''));
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((r) => !service || r.a.subscription_id === service)
      .filter((r) => !onlyTerminated || r.a.employee_status === 'desligado')
      .filter((r) => !q || [r.a.employee_name, r.a.employee_email, r.a.employee_department].some((v) => v?.toLowerCase().includes(q)));
  }, [all, service, search, onlyTerminated]);

  if (loading) return <ReportLoading />;
  if (error || !data) return <ReportError message={error || 'Erro ao carregar as licenças.'} />;

  const terminated = all.filter((r) => r.a.employee_status === 'desligado');
  const wasted = terminated.reduce((s, r) => s + (r.perLicense || 0), 0);
  const people = new Set(rows.map((r) => r.a.employee_id)).size;
  const section: ReportSection<Row> = {
    title: 'Licenças por funcionário',
    columns: COLUMNS,
    rows,
    footer: `${rows.length} licenças · ${people} funcionários · custo mensal estimado: ${brl(rows.reduce((s, r) => s + (r.perLicense || 0), 0))}`,
    empty: 'Nenhuma licença com esses filtros.',
  };
  const subtitle = [
    service && `Serviço: ${data.subs.find((s) => s.id === service)?.service_name}`,
    onlyTerminated && 'Só funcionários desligados',
    search && `Busca: "${search}"`,
  ].filter(Boolean).join(' · ') || 'Todas as licenças atribuídas';

  return (
    <div className="space-y-4">
      <FilterBar>
        <Field label="Serviço">
          <select value={service} onChange={(e) => setService(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {[...data.subs].sort((a, b) => a.service_name.localeCompare(b.service_name)).map((s) => <option key={s.id} value={s.id}>{s.service_name}</option>)}
          </select>
        </Field>
        <Field label="Buscar funcionário">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, e-mail, departamento" className={`${inputCls} w-56`} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pb-1.5">
          <input type="checkbox" checked={onlyTerminated} onChange={(e) => setOnlyTerminated(e.target.checked)} className="w-4 h-4 rounded" />
          Só desligados
        </label>
        <div className="ml-auto"><ReportActions title="Licenças por funcionário" subtitle={subtitle} fileSlug="licencas_por_funcionario" sections={[section]} landscape /></div>
      </FilterBar>

      <StatCards items={[
        { label: 'licenças atribuídas', value: all.length, tone: 'blue' },
        { label: 'funcionários com licença', value: new Set(all.map((r) => r.a.employee_id)).size },
        { label: 'licenças com desligados', value: terminated.length, tone: terminated.length ? 'rose' : 'slate' },
        { label: 'custo mensal com desligados', value: brl(wasted), tone: wasted ? 'rose' : 'slate' },
      ]} />

      {terminated.length > 0 && !onlyTerminated && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-xs">
          {terminated.length} {terminated.length === 1 ? 'licença continua atribuída' : 'licenças continuam atribuídas'} a funcionários desligados.
          Marque "Só desligados" para ver e remova em Assinaturas &amp; Licenças.
        </div>
      )}

      <ReportTable section={section} showTitle={false} />
      <p className="text-[11px] text-slate-500">Custo por licença = custo mensal do serviço ÷ número de licenças contratadas (anuais divididas por 12).</p>
    </div>
  );
};
