import React, { useMemo, useState } from 'react';
import { EmployeeService } from '../../services/employeeService';
import { IMAGE_STATUS_LABEL, ImageTerm, ImageTermService, ImageTermStatus } from '../../services/imageTermService';
import { Employee } from '../../types/employee';
import { ReportColumn, ReportSection } from '../../lib/reports/tableReport';
import { Field, FilterBar, inputCls, ReportActions, ReportError, ReportLoading, ReportTable, StatCards, useReportData } from './ReportKit';

type Row = { employee: Employee; term: ImageTerm | null; status: ImageTermStatus };

const EMPLOYEE_STATUS: Record<string, string> = { ativo: 'Ativo', afastado: 'Afastado', desligado: 'Desligado' };

const COLUMNS: ReportColumn<Row>[] = [
  { header: 'Funcionário', value: (r) => r.employee.full_name, width: 30 },
  { header: 'Departamento', value: (r) => r.employee.department, width: 16 },
  { header: 'Unidade', value: (r) => r.employee.unit, width: 20 },
  { header: 'Situação', value: (r) => EMPLOYEE_STATUS[r.employee.status] || r.employee.status, width: 11 },
  { header: 'Uso de imagem', value: (r) => IMAGE_STATUS_LABEL[r.status], width: 15 },
  { header: 'Assinado em', value: (r) => r.term?.signed_at, kind: 'date', width: 12 },
  { header: 'PDF anexado', value: (r) => (r.term?.file_path ? 'Sim' : 'Não'), width: 11 },
  { header: 'Cópia por e-mail', value: (r) => r.term?.emailed_at?.slice(0, 10), kind: 'date', width: 14 },
  { header: 'Observação', value: (r) => r.term?.notes, width: 30 },
];

const ORDER: Record<ImageTermStatus, number> = { pendente: 0, nao_autorizado: 1, autorizado: 2 };

/** Relatórios › Termos de uso de imagem */
export const ImageTermsReport: React.FC = () => {
  const { data, error, loading } = useReportData(async () => {
    const [employees, terms] = await Promise.all([EmployeeService.getEmployees(), ImageTermService.listAll()]);
    return { employees, terms };
  });
  const [status, setStatus] = useState<'todos' | ImageTermStatus>('todos');
  const [dept, setDept] = useState('todos');
  const [unit, setUnit] = useState('todos');
  const [includeTerminated, setIncludeTerminated] = useState(false);

  const all = useMemo<Row[]>(() => (data?.employees || [])
    .filter((e) => includeTerminated || e.status !== 'desligado')
    .map((employee) => {
      const term = data!.terms.get(employee.id) || null;
      return { employee, term, status: term ? term.status : 'pendente' as ImageTermStatus };
    })
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.employee.full_name.localeCompare(b.employee.full_name, 'pt-BR')),
  [data, includeTerminated]);

  const departments = useMemo(() => [...new Set(all.map((r) => r.employee.department).filter(Boolean))].sort(), [all]);
  const units = useMemo(() => [...new Set(all.map((r) => r.employee.unit).filter(Boolean))].sort(), [all]);
  const scoped = all.filter((r) => (dept === 'todos' || r.employee.department === dept) && (unit === 'todos' || r.employee.unit === unit));
  const rows = scoped.filter((r) => status === 'todos' || r.status === status);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError message={error} />;

  const count = (s: ImageTermStatus) => scoped.filter((r) => r.status === s).length;
  const subtitle = [
    status === 'todos' ? 'Todas as situações' : IMAGE_STATUS_LABEL[status],
    dept !== 'todos' ? dept : '',
    unit !== 'todos' ? unit : '',
    includeTerminated ? 'incluindo desligados' : 'sem desligados',
  ].filter(Boolean).join(' · ');
  const section: ReportSection<Row> = { title: 'Termos de uso de imagem', columns: COLUMNS, rows, empty: 'Nenhum funcionário com esses filtros.' };

  return (
    <div className="space-y-4">
      <FilterBar>
        <Field label="Uso de imagem">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
            <option value="todos">Todas</option>
            <option value="pendente">Pendente</option>
            <option value="autorizado">Autorizado</option>
            <option value="nao_autorizado">Não autorizado</option>
          </select>
        </Field>
        <Field label="Departamento">
          <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls}>
            <option value="todos">Todos</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        {units.length > 1 && (
          <Field label="Unidade">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
              <option value="todos">Todas</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pb-1.5">
          <input type="checkbox" checked={includeTerminated} onChange={(e) => setIncludeTerminated(e.target.checked)} className="w-4 h-4 rounded" />
          Incluir desligados
        </label>
        <div className="ml-auto">
          <ReportActions title="Termos de uso de imagem" subtitle={subtitle} fileSlug="termos_uso_de_imagem" sections={[section]} landscape />
        </div>
      </FilterBar>

      <StatCards items={[
        { label: 'autorizaram', value: count('autorizado'), tone: 'emerald' },
        { label: 'pendentes', value: count('pendente'), tone: 'amber' },
        { label: 'não autorizaram', value: count('nao_autorizado'), tone: 'rose' },
        { label: 'autorizados sem PDF', value: scoped.filter((r) => r.status === 'autorizado' && !r.term?.file_path).length },
      ]} />

      <ReportTable section={section} showTitle={false} />
    </div>
  );
};
