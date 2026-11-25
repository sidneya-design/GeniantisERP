import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock, Inbox, CalendarDays, Settings2, PartyPopper, RefreshCw, Check, X, Plus, Trash2, Search, PiggyBank, Download,
  UserCheck, ShieldAlert, FileSpreadsheet, MapPin, MapPinOff,
} from 'lucide-react';
import { exportTimesheetsToExcel } from '../lib/reports/timesheetExport';
import { Link } from 'react-router-dom';
import { usePermission } from '../lib/usePermission';
import { useAuth } from '../contexts/AuthContext';
import {
  DefaultSchedule, DepartmentManager, EmployeeOption, ManagerCandidate, KIND_LABEL, REQUEST_STATUS, TimeBank, TimeBankEntry, TimeDay, TimeHoliday, TimeOverviewRow,
  TimePunch, TimeRequest, TimeSchedule, TimesheetService, WEEKDAY_LONG, WEEKDAY_SHORT,
  balanceClass, currentMonthKey, fmtMinutes, fmtTime, monthLabel, monthRange, parseMinutes, punchLabel, punchMapUrl,
} from '../services/timesheetService';
import { formatDate, todayISO } from '../services/subscriptionService';
import {
  DailyTable, EditButton, Feedback, FeedbackBar, Modal, MonthNav, RequestForm, RequestFormValue, StatCard,
  emptyRequest, inputClass, labelClass,
} from '../components/timesheet/TimesheetParts';

type Tab = 'resumo' | 'pendencias' | 'espelho' | 'jornadas' | 'feriados' | 'responsaveis';

const TABS: { key: Tab; label: string; icon: React.ElementType; moduleOnly?: boolean }[] = [
  { key: 'resumo', label: 'Resumo', icon: Clock },
  { key: 'pendencias', label: 'Pendências', icon: Inbox },
  { key: 'espelho', label: 'Espelho', icon: CalendarDays },
  { key: 'jornadas', label: 'Jornadas', icon: Settings2, moduleOnly: true },
  { key: 'feriados', label: 'Feriados', icon: PartyPopper, moduleOnly: true },
  { key: 'responsaveis', label: 'Responsáveis', icon: UserCheck, moduleOnly: true },
];

const btn = 'inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold bg-white';
const btnPrimary = 'inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50';

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const Timesheet: React.FC = () => {
  const perms = usePermission('timesheet');
  const { managedDepartments } = useAuth();
  // Níveis do módulo: 1 Ver (todos) · 2 Aprovar pedidos · 3 Gerenciar (jornadas, feriados, marcações, banco)
  // Responsável por departamento: vê e (se marcado) aprova só a equipe do(s) seu(s) departamento(s)
  const hasModule = perms.canView;
  const canManage = perms.canDelete;
  const canApproveRequest = (r: TimeRequest) =>
    perms.canEdit || managedDepartments.some((d) => d.can_approve && d.department_name === r.employee_department);
  const anyApprove = perms.canEdit || managedDepartments.some((d) => d.can_approve);

  const [tab, setTab] = useState<Tab>('resumo');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [month, setMonth] = useState(currentMonthKey());
  const [pendingCount, setPendingCount] = useState(0);

  const flash = (f: Feedback) => {
    setFeedback(f);
    if (f?.type === 'success') setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    TimesheetService.employees().then(setEmployees).catch((e) => flash({ type: 'error', text: e.message }));
    TimesheetService.requests({ status: 'pendente', limit: 500 }).then((r) => setPendingCount(r.length)).catch(() => undefined);
  }, []);

  const openEmployee = (id: string) => {
    setSelectedId(id);
    setTab('espelho');
  };

  if (!hasModule && managedDepartments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-12 shadow-sm">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-sm text-slate-600 mt-2">Você não tem acesso ao Controle de Ponto nem é responsável por um departamento.</p>
        <Link to="/" className="inline-flex mt-6 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Ir para o início</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">Controle de Ponto</h2>
          <p className="text-slate-500 text-sm mt-1">
            {hasModule
              ? 'Marcações, aprovações, folgas, férias e banco de horas dos funcionários.'
              : `Você é responsável por: ${managedDepartments.map((d) => d.department_name + (d.can_approve ? '' : ' (só ver)')).join(', ')}.`}
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {TABS.filter((t) => hasModule || !t.moduleOnly).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
            {t.key === 'pendencias' && pendingCount > 0 && (
              <span className={`text-[10px] px-1.5 rounded-full ${tab === t.key ? 'bg-white/25' : 'bg-amber-100 text-amber-800'}`}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <FeedbackBar feedback={feedback} onClose={() => setFeedback(null)} />

      {tab === 'resumo' && <OverviewTab month={month} setMonth={setMonth} onOpen={openEmployee} flash={flash} />}
      {tab === 'pendencias' && <PendingTab canApprove={canApproveRequest} anyApprove={anyApprove} flash={flash} onCount={setPendingCount} />}
      {tab === 'espelho' && (
        <EmployeeTab
          employees={employees} selectedId={selectedId} setSelectedId={setSelectedId}
          month={month} setMonth={setMonth} canEdit={canManage} canDelete={canManage} flash={flash}
        />
      )}
      {tab === 'jornadas' && <SchedulesTab employees={employees} canEdit={canManage} flash={flash} />}
      {tab === 'feriados' && <HolidaysTab canEdit={canManage} flash={flash} />}
      {tab === 'responsaveis' && <ManagersTab employees={employees} canEdit={canManage} flash={flash} />}
    </div>
  );
};

// ---------------- Resumo ----------------

const OverviewTab: React.FC<{ month: string; setMonth: (m: string) => void; onOpen: (id: string) => void; flash: (f: Feedback) => void }> = ({
  month, setMonth, onOpen, flash,
}) => {
  const [rows, setRows] = useState<TimeOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = monthRange(month);
      setRows(await TimesheetService.overview(from, to));
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const departments = useMemo(
    () => Array.from(new Set(rows.map((r) => r.department).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  // Ordenado por departamento e nome
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !department || r.department === department)
      .filter((r) => !q || r.full_name.toLowerCase().includes(q) || r.department?.toLowerCase().includes(q))
      .sort((a, b) => (a.department || '').localeCompare(b.department || '') || a.full_name.localeCompare(b.full_name));
  }, [rows, search, department]);

  // Os cartões seguem o filtro de departamento
  const sum = (k: keyof TimeOverviewRow) => visible.reduce((s, r) => s + (r[k] as number), 0);

  const slug = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

  const exportCsv = () =>
    downloadCsv(`ponto-${month}${department ? `-${slug(department)}` : ''}.csv`, [
      ['Funcionário', 'Departamento', 'Previsto', 'Trabalhado', 'Saldo do mês', 'Faltas', 'Dias incompletos', 'Banco de horas', 'Pendências'],
      ...visible.map((r) => [
        r.full_name, r.department, fmtMinutes(r.expected_minutes), fmtMinutes(r.worked_minutes), fmtMinutes(r.period_balance, true),
        r.absences, r.incomplete_days, fmtMinutes(r.bank_total, true), r.pending_requests,
      ]),
    ]);

  const [excelProgress, setExcelProgress] = useState('');
  const exportExcel = async () => {
    setExcelProgress('Preparando…');
    try {
      await exportTimesheetsToExcel(
        month, visible, `folhas-ponto-${month}${department ? `-${slug(department)}` : ''}.xlsx`,
        (done, total) => setExcelProgress(`${done}/${total}`),
      );
    } catch (e: any) {
      flash({ type: 'error', text: e.message || 'Não foi possível gerar o Excel.' });
    } finally {
      setExcelProgress('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Funcionários" value={visible.length} hint={`${department || 'Todos os departamentos'} · ${monthLabel(month)}`} />
        <StatCard label="Faltas no mês" value={sum('absences')} valueClass={sum('absences') ? 'text-rose-600' : undefined} />
        <StatCard label="Dias incompletos" value={sum('incomplete_days')} valueClass={sum('incomplete_days') ? 'text-amber-600' : undefined} hint="Marcação faltando" />
        <StatCard label="Saldo geral do banco" value={fmtMinutes(sum('bank_total'), true)} valueClass={balanceClass(sum('bank_total'))} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar funcionário" className={`${inputClass} pl-9`} />
        </div>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={`${inputClass} sm:w-56`} aria-label="Departamento">
          <option value="">Todos os departamentos</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          <MonthNav month={month} onChange={setMonth} />
          <button onClick={load} className={btn}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
          <button onClick={exportCsv} disabled={!visible.length} className={btn}><Download className="w-4 h-4" /> CSV</button>
          <button onClick={exportExcel} disabled={!visible.length || !!excelProgress} className={btn} title="Resumo e espelho de cada funcionário filtrado, um por aba">
            <FileSpreadsheet className={`w-4 h-4 ${excelProgress ? 'animate-pulse' : ''}`} /> {excelProgress || 'Excel'}
          </button>
        </div>
      </div>

      {/* Celular: um cartão por funcionário */}
      <div className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && <p className="px-4 py-8 text-center text-sm text-slate-500">Calculando...</p>}
        {!loading && visible.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum funcionário.</p>}
        {!loading && visible.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {visible.map((r, i) => (
              <React.Fragment key={r.employee_id}>
                {!department && (i === 0 || visible[i - 1].department !== r.department) && (
                  <li className="bg-slate-50/80 px-4 py-1.5 text-xs font-bold uppercase text-slate-500">
                    {r.department || 'Sem departamento'} · {visible.filter((x) => x.department === r.department).length}
                  </li>
                )}
                <li>
                  <button type="button" onClick={() => onOpen(r.employee_id)} className="w-full text-left px-4 py-3 active:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{r.full_name}</div>
                        {r.pending_requests > 0 && <div className="text-xs text-amber-700">{r.pending_requests} pendente(s)</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-bold tabular-nums ${balanceClass(r.bank_total)}`}>{fmtMinutes(r.bank_total, true)}</div>
                        <div className="text-[11px] text-slate-400">banco</div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                      <span>{fmtMinutes(r.worked_minutes)} de {fmtMinutes(r.expected_minutes)}</span>
                      <span className={`font-semibold ${balanceClass(r.period_balance)}`}>mês {fmtMinutes(r.period_balance, true)}</span>
                      <span className={r.absences ? 'text-rose-600 font-semibold' : ''}>{r.absences} falta(s)</span>
                      <span className={r.incomplete_days ? 'text-amber-600 font-semibold' : ''}>{r.incomplete_days} incompleto(s)</span>
                    </div>
                  </button>
                </li>
              </React.Fragment>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Funcionário</th>
              <th className="text-right px-4 py-2.5 font-semibold">Previsto</th>
              <th className="text-right px-4 py-2.5 font-semibold">Trabalhado</th>
              <th className="text-right px-4 py-2.5 font-semibold">Saldo do mês</th>
              <th className="text-right px-4 py-2.5 font-semibold">Faltas</th>
              <th className="text-right px-4 py-2.5 font-semibold">Incompletos</th>
              <th className="text-right px-4 py-2.5 font-semibold">Banco</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Calculando...</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum funcionário.</td></tr>}
            {!loading && visible.map((r, i) => (
              <React.Fragment key={r.employee_id}>
              {!department && (i === 0 || visible[i - 1].department !== r.department) && (
                <tr className="bg-slate-50/80">
                  <td colSpan={8} className="px-4 py-1.5 text-xs font-bold uppercase text-slate-500">
                    {r.department || 'Sem departamento'} · {visible.filter((x) => x.department === r.department).length}
                  </td>
                </tr>
              )}
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="font-semibold text-slate-800">{r.full_name}</div>
                  <div className="text-xs text-slate-500">
                    {r.department}
                    {r.pending_requests > 0 && <span className="ml-2 text-amber-700">· {r.pending_requests} pendente(s)</span>}
                  </div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-500">{fmtMinutes(r.expected_minutes)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtMinutes(r.worked_minutes)}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-semibold ${balanceClass(r.period_balance)}`}>{fmtMinutes(r.period_balance, true)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${r.absences ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>{r.absences}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${r.incomplete_days ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>{r.incomplete_days}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-bold ${balanceClass(r.bank_total)}`}>{fmtMinutes(r.bank_total, true)}</td>
                <td className="px-4 py-2 text-right"><EditButton label="Espelho" onClick={() => onOpen(r.employee_id)} /></td>
              </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Os totais consideram só dias encerrados (até ontem). Banco de horas = saldo acumulado desde o início do controle + lançamentos manuais.</p>
    </div>
  );
};

// ---------------- Pendências ----------------

const PendingTab: React.FC<{
  canApprove: (r: TimeRequest) => boolean; anyApprove: boolean; flash: (f: Feedback) => void; onCount: (n: number) => void;
}> = ({ canApprove, anyApprove, flash, onCount }) => {
  const [rows, setRows] = useState<TimeRequest[]>([]);
  const [history, setHistory] = useState<TimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await TimesheetService.requests({ limit: 300 });
      const pending = all.filter((r) => r.status === 'pendente').sort((a, b) => a.created_at.localeCompare(b.created_at));
      setRows(pending);
      setHistory(all.filter((r) => r.status !== 'pendente').slice(0, 30));
      onCount(pending.length);
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (r: TimeRequest, approve: boolean) => {
    if (!approve && !notes[r.id]?.trim() && !window.confirm('Recusar sem escrever o motivo?')) return;
    setBusyId(r.id);
    try {
      await TimesheetService.review(r.id, approve, notes[r.id]);
      flash({ type: 'success', text: `${KIND_LABEL[r.kind]} de ${r.employee_name || 'funcionário'} ${approve ? 'aprovado(a)' : 'recusado(a)'}.` });
      await load();
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const period = (r: TimeRequest) =>
    r.kind === 'ajuste'
      ? `${formatDate(r.start_date)} às ${r.punch_time?.slice(0, 5)}`
      : r.start_date === r.end_date ? formatDate(r.start_date) : `${formatDate(r.start_date)} a ${formatDate(r.end_date)}`;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex justify-end">
        <button onClick={load} className={btn}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {!loading && rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nenhuma solicitação pendente.</p>}
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">{r.employee_name || '—'}</span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-slate-50 border-slate-200 text-slate-700">{KIND_LABEL[r.kind]}</span>
                <span className="text-xs text-slate-500">pedido em {new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <p className="text-sm text-slate-700 mt-1"><strong>{period(r)}</strong> · {r.reason}</p>
              {r.employee_department && <p className="text-xs text-slate-400 mt-0.5">{r.employee_department}</p>}
            </div>
            {canApprove(r) ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={notes[r.id] || ''}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                  placeholder="Resposta (opcional)"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs w-full sm:w-48"
                />
                <button disabled={busyId === r.id} onClick={() => review(r, true)} className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                  <Check className="w-4 h-4" /> Aprovar
                </button>
                <button disabled={busyId === r.id} onClick={() => review(r, false)} className="inline-flex items-center gap-1 px-3 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold disabled:opacity-50">
                  <X className="w-4 h-4" /> Recusar
                </button>
              </div>
            ) : anyApprove ? (
              <span className="text-xs text-slate-500">Analisado pelo RH</span>
            ) : null}
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-700">Analisadas recentemente</h3>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {history.map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-slate-700">{r.employee_name || '—'}</span>
                <span className="text-slate-500">{KIND_LABEL[r.kind]} · {period(r)}</span>
                <span className={`ml-auto px-2 py-0.5 rounded-md text-[11px] font-semibold border ${REQUEST_STATUS[r.status].cls}`}>{REQUEST_STATUS[r.status].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------- Espelho do funcionário ----------------

const EmployeeSelect: React.FC<{ employees: EmployeeOption[]; value: string; onChange: (id: string) => void }> = ({ employees, value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} sm:w-72`}>
    <option value="">Escolha o funcionário...</option>
    {employees.map((e) => (
      <option key={e.id} value={e.id}>{e.full_name}{e.status === 'desligado' ? ' (desligado)' : ''}</option>
    ))}
  </select>
);

const EmployeeTab: React.FC<{
  employees: EmployeeOption[]; selectedId: string; setSelectedId: (id: string) => void;
  month: string; setMonth: (m: string) => void; canEdit: boolean; canDelete: boolean; flash: (f: Feedback) => void;
}> = ({ employees, selectedId, setSelectedId, month, setMonth, canEdit, canDelete, flash }) => {
  const [days, setDays] = useState<TimeDay[]>([]);
  const [bank, setBank] = useState<TimeBank | null>(null);
  const [entries, setEntries] = useState<TimeBankEntry[]>([]);
  const [requests, setRequests] = useState<TimeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [dayEdit, setDayEdit] = useState<{ date: string; punches: TimePunch[] } | null>(null);
  const [newPunch, setNewPunch] = useState({ time: '', note: '' });
  const [absenceForm, setAbsenceForm] = useState<RequestFormValue | null>(null);
  const [entryForm, setEntryForm] = useState<{ date: string; amount: string; type: 'credito' | 'debito'; reason: string } | null>(null);

  const employee = employees.find((e) => e.id === selectedId);

  const load = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const { from, to } = monthRange(month);
      const [d, b, en, rq] = await Promise.all([
        TimesheetService.daily(selectedId, from, to),
        TimesheetService.bank(selectedId),
        TimesheetService.bankEntries(selectedId),
        TimesheetService.requests({ employeeId: selectedId, limit: 30 }),
      ]);
      setDays(d);
      setBank(b);
      setEntries(en);
      setRequests(rq.filter((r) => r.kind !== 'ajuste' && r.status === 'aprovado'));
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const openDay = async (date: string) => {
    try {
      setDayEdit({ date, punches: await TimesheetService.punches(selectedId, date, date) });
      setNewPunch({ time: '', note: '' });
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    }
  };

  const refreshDay = async () => {
    if (!dayEdit) return;
    setDayEdit({ ...dayEdit, punches: await TimesheetService.punches(selectedId, dayEdit.date, dayEdit.date) });
    await load();
  };

  const addPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayEdit) return;
    setBusy(true);
    try {
      await TimesheetService.addManualPunch(selectedId, dayEdit.date, newPunch.time, newPunch.note);
      setNewPunch({ time: '', note: '' });
      await refreshDay();
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const removePunch = async (p: TimePunch) => {
    if (!window.confirm(`Excluir a marcação das ${fmtTime(p.punched_at)}?`)) return;
    try {
      await TimesheetService.deletePunch(p.id);
      await refreshDay();
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    }
  };

  const saveAbsence = async (v: RequestFormValue) => {
    setBusy(true);
    try {
      await TimesheetService.createRequest({ ...v, employee_id: selectedId, approved: true });
      setAbsenceForm(null);
      flash({ type: 'success', text: `${KIND_LABEL[v.kind]} lançado(a).` });
      await load();
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryForm) return;
    const mins = parseMinutes(entryForm.amount);
    if (!mins || mins <= 0) {
      flash({ type: 'error', text: 'Informe as horas como 2:30 ou 2h30.' });
      return;
    }
    setBusy(true);
    try {
      await TimesheetService.addBankEntry(selectedId, entryForm.date, entryForm.type === 'credito' ? mins : -mins, entryForm.reason);
      setEntryForm(null);
      flash({ type: 'success', text: 'Lançamento incluído no banco de horas.' });
      await load();
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const removeEntry = async (en: TimeBankEntry) => {
    if (!window.confirm('Excluir este lançamento do banco de horas?')) return;
    try {
      await TimesheetService.deleteBankEntry(en.id);
      await load();
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    }
  };

  const exportCsv = () =>
    downloadCsv(`espelho-${employee?.full_name || 'funcionario'}-${month}.csv`, [
      ['Data', 'Dia', 'Marcações', 'Previsto', 'Trabalhado', 'Saldo', 'Situação', 'Observação'],
      ...days.map((d) => [
        formatDate(d.work_date), WEEKDAY_SHORT[d.weekday], d.punches.map(fmtTime).join(' '),
        fmtMinutes(d.expected_minutes), fmtMinutes(d.worked_minutes), d.balance_minutes === null ? '' : fmtMinutes(d.balance_minutes, true),
        d.status, d.holiday || (d.absence ? KIND_LABEL[d.absence] : ''),
      ]),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EmployeeSelect employees={employees} value={selectedId} onChange={setSelectedId} />
        {selectedId && (
          <div className="flex flex-wrap gap-2">
            <MonthNav month={month} onChange={setMonth} />
            <button onClick={load} className={btn}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
            <button onClick={exportCsv} disabled={!days.length} className={btn}><Download className="w-4 h-4" /> CSV</button>
            {canEdit && (
              <button onClick={() => setAbsenceForm(emptyRequest('ferias'))} className={btnPrimary}>
                <Plus className="w-4 h-4" /> Férias / folga
              </button>
            )}
          </div>
        )}
      </div>

      {!selectedId ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Escolha um funcionário para ver o espelho de ponto.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <StatCard
              icon={PiggyBank} label="Banco de horas" value={fmtMinutes(bank?.total_minutes ?? 0, true)} valueClass={balanceClass(bank?.total_minutes)}
              hint={bank ? `Dias: ${fmtMinutes(bank.days_minutes, true)} · Lançamentos: ${fmtMinutes(bank.entries_minutes, true)} · desde ${formatDate(bank.start_date)}` : undefined}
            />
            <div className="md:col-span-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Lançamentos no banco</span>
                {canEdit && (
                  <button onClick={() => setEntryForm({ date: todayISO(), amount: '', type: 'credito', reason: '' })} className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Lançar
                  </button>
                )}
              </div>
              <ul className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                {entries.length === 0 && <li className="text-xs text-slate-500">Nenhum lançamento manual (ex.: saldo inicial, horas pagas).</li>}
                {entries.map((en) => (
                  <li key={en.id} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 tabular-nums">{formatDate(en.entry_date)}</span>
                    <span className={`font-semibold tabular-nums ${balanceClass(en.minutes)}`}>{fmtMinutes(en.minutes, true)}</span>
                    <span className="text-slate-600 truncate flex-1">{en.reason}</span>
                    {canDelete && (
                      <button onClick={() => removeEntry(en)} className="text-slate-400 hover:text-rose-600" aria-label="Excluir lançamento"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DailyTable
            days={days}
            loading={loading}
            rowAction={(d) => (d.status !== 'futuro' && d.punches.length + (canEdit ? 1 : 0) > 0
              ? <EditButton label={canEdit ? 'Marcações' : 'Ver marcações'} onClick={() => openDay(d.work_date)} />
              : null)}
          />

          {requests.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Férias, folgas e ausências aprovadas</h3>
              <ul className="space-y-1 text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="text-slate-700">
                    <strong>{KIND_LABEL[r.kind]}</strong> · {r.start_date === r.end_date ? formatDate(r.start_date) : `${formatDate(r.start_date)} a ${formatDate(r.end_date)}`} · <span className="text-slate-500">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {dayEdit && (
        <Modal title={`Marcações de ${formatDate(dayEdit.date)} · ${employee?.full_name || ''}`} onClose={() => setDayEdit(null)}>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {dayEdit.punches.length === 0 && <li className="p-3 text-sm text-slate-500">Nenhuma marcação neste dia.</li>}
            {dayEdit.punches.map((p, i) => (
              <li key={p.id} className="p-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-mono font-semibold tabular-nums">{fmtTime(p.punched_at)}</span>
                <span className="text-slate-600">{punchLabel(i)}</span>
                <span className="text-[11px] px-1.5 rounded border border-slate-200 text-slate-500">{p.source === 'ponto' ? 'batido' : p.source}</span>
                {p.source === 'ponto' && (punchMapUrl(p) ? (
                  <a href={punchMapUrl(p)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline" title="Abrir no Google Maps">
                    <MapPin className="w-3.5 h-3.5" /> Ver no mapa{p.accuracy_m ? ` (± ${Math.round(p.accuracy_m)} m)` : ''}
                  </a>
                ) : p.location_status ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-1.5 rounded border border-amber-200 bg-amber-50 text-amber-700">
                    <MapPinOff className="w-3 h-3" /> {p.location_status === 'negada' ? 'Sem localização (não permitiu)' : 'Sem localização (aparelho)'}
                  </span>
                ) : null)}
                {p.note && <span className="text-xs text-slate-500 truncate flex-1">{p.note}</span>}
                {canDelete && (
                  <button onClick={() => removePunch(p)} className="ml-auto text-slate-400 hover:text-rose-600" aria-label="Excluir marcação"><Trash2 className="w-4 h-4" /></button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
          <form onSubmit={addPunch} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <label className={labelClass}>Horário</label>
              <input type="time" required value={newPunch.time} onChange={(e) => setNewPunch({ ...newPunch, time: e.target.value })} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Motivo</label>
              <input required value={newPunch.note} onChange={(e) => setNewPunch({ ...newPunch, note: e.target.value })} placeholder="Ex.: esqueceu de bater" className={inputClass} />
            </div>
            <button type="submit" disabled={busy} className={`${btnPrimary} sm:col-span-3 justify-center py-2.5`}><Plus className="w-4 h-4" /> Incluir marcação</button>
          </form>
          )}
          <p className="text-xs text-slate-500">
            As marcações são ordenadas por horário: 1ª entrada, 2ª saída para almoço, 3ª volta, 4ª saída. Toda inclusão ou exclusão fica no log de atividades.
          </p>
        </Modal>
      )}

      {absenceForm && (
        <Modal title={`Lançar para ${employee?.full_name || ''}`} onClose={() => setAbsenceForm(null)}>
          <p className="text-xs text-slate-500 -mt-2">O lançamento já entra aprovado.</p>
          <RequestForm initial={absenceForm} busy={busy} submitLabel="Lançar" onCancel={() => setAbsenceForm(null)} onSubmit={saveAbsence} />
        </Modal>
      )}

      {entryForm && (
        <Modal title="Lançamento no banco de horas" onClose={() => setEntryForm(null)}>
          <form onSubmit={saveEntry} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Tipo</label>
                <select value={entryForm.type} onChange={(e) => setEntryForm({ ...entryForm, type: e.target.value as 'credito' | 'debito' })} className={inputClass}>
                  <option value="credito">Crédito (+)</option>
                  <option value="debito">Débito (−)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Horas</label>
                <input required value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} placeholder="2:30" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Data</label>
                <input type="date" required value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Motivo</label>
              <input required value={entryForm.reason} onChange={(e) => setEntryForm({ ...entryForm, reason: e.target.value })} placeholder="Ex.: saldo inicial, horas pagas na folha" className={inputClass} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEntryForm(null)} className={btn}>Cancelar</button>
              <button type="submit" disabled={busy} className={btnPrimary}>Lançar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ---------------- Jornadas ----------------

const toHM = (m: number) => (m ? fmtMinutes(m).replace('h', ':') : '');
const weekText = (w: number[]) => w.map(toHM);

// Lê os 7 campos ("8:00", vazio = folga); null se algum for inválido
function parseWeek(week: string[]): number[] | null {
  const mins = week.map((w) => (w.trim() ? parseMinutes(w) : 0));
  return mins.some((m) => m === null || m < 0 || m > 960) ? null : (mins as number[]);
}
const weekSum = (week: string[]) => week.reduce((s, w) => s + (w.trim() ? parseMinutes(w) || 0 : 0), 0);

// "09:00" → minutos do dia
const clock = (t: string) => {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const WeekInputs: React.FC<{ week: string[]; disabled: boolean; onChange: (w: string[]) => void }> = ({ week, disabled, onChange }) => (
  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
    {WEEKDAY_LONG.map((name, i) => (
      <div key={name}>
        <label className={labelClass}>{WEEKDAY_SHORT[i]}</label>
        <input
          value={week[i]} disabled={disabled} placeholder="folga" aria-label={`Horas de ${name}`}
          onChange={(e) => onChange(week.map((w, j) => (j === i ? e.target.value : w)))}
          className={`${inputClass} text-center tabular-nums px-1`}
        />
      </div>
    ))}
  </div>
);

const SchedulesTab: React.FC<{ employees: EmployeeOption[]; canEdit: boolean; flash: (f: Feedback) => void }> = ({ employees, canEdit, flash }) => {
  const [startDate, setStartDate] = useState('');
  const [savedStart, setSavedStart] = useState('');
  const [def, setDef] = useState<DefaultSchedule | null>(null);
  const [defForm, setDefForm] = useState<{ week: string[]; tolerance: string; start: string; end: string; brk: string } | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<{ useDefault: boolean; week: string[]; tolerance: string; bank_start_date: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fillDefForm = (d: DefaultSchedule) =>
    setDefForm({
      week: weekText(d.weekday_minutes), tolerance: String(d.tolerance_minutes),
      start: d.start_time || '', end: d.end_time || '', brk: d.break_minutes === null ? '' : String(d.break_minutes),
    });

  useEffect(() => {
    TimesheetService.startDate().then((d) => { setStartDate(d); setSavedStart(d); }).catch((e) => flash({ type: 'error', text: e.message }));
    TimesheetService.defaultSchedule().then((d) => { setDef(d); fillDefForm(d); }).catch((e) => flash({ type: 'error', text: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId || !def) { setForm(null); return; }
    TimesheetService.schedule(selectedId)
      .then((s) => setForm({
        useDefault: !s?.weekday_minutes,
        week: weekText(s?.weekday_minutes || def.weekday_minutes),
        tolerance: String(s?.tolerance_minutes ?? def.tolerance_minutes),
        bank_start_date: s?.bank_start_date || '',
      }))
      .catch((e) => flash({ type: 'error', text: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, def]);

  const saveStart = async () => {
    if (!window.confirm(`Mudar o início geral do controle de ponto para ${formatDate(startDate)}? Isso recalcula o banco de horas de quem não tem data própria.`)) return;
    setBusy(true);
    try {
      await TimesheetService.saveStartDate(startDate);
      setSavedStart(startDate);
      flash({ type: 'success', text: 'Início do controle atualizado.' });
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  // Entrada - saída - intervalo → horas por dia
  const dayFromClock = defForm ? (() => {
    const a = clock(defForm.start), b = clock(defForm.end);
    if (a === null || b === null || b <= a) return null;
    const m = b - a - (Number(defForm.brk) || 0);
    return m > 0 && m <= 960 ? m : null;
  })() : null;

  const applyWeekdays = () => {
    if (!defForm || dayFromClock === null) return;
    setDefForm({ ...defForm, week: defForm.week.map((w, i) => (i >= 1 && i <= 5 ? toHM(dayFromClock) : w)) });
  };

  const saveDefault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defForm) return;
    const week = parseWeek(defForm.week);
    if (!week) {
      flash({ type: 'error', text: 'Use horas como 8:00 (máximo 16:00 por dia). Deixe vazio nos dias de folga.' });
      return;
    }
    if ((defForm.start && clock(defForm.start) === null) || (defForm.end && clock(defForm.end) === null)) {
      flash({ type: 'error', text: 'Entrada e saída no formato 09:00.' });
      return;
    }
    if (!window.confirm('Salvar a jornada padrão? Vale para todos que seguem o padrão e recalcula o banco de horas deles desde o início do controle.')) return;
    setBusy(true);
    try {
      const d: DefaultSchedule = {
        weekday_minutes: week,
        tolerance_minutes: Math.max(0, Math.min(60, Number(defForm.tolerance) || 0)),
        start_time: defForm.start || null,
        end_time: defForm.end || null,
        break_minutes: defForm.brk.trim() ? Math.max(0, Math.min(600, Number(defForm.brk) || 0)) : null,
      };
      await TimesheetService.saveDefaultSchedule(d);
      setDef(d);
      fillDefForm(d);
      flash({ type: 'success', text: 'Jornada padrão salva.' });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const week = form.useDefault ? null : parseWeek(form.week);
    if (!form.useDefault && !week) {
      flash({ type: 'error', text: 'Use horas como 8:00 (máximo 16:00 por dia). Deixe vazio nos dias de folga.' });
      return;
    }
    setBusy(true);
    try {
      const schedule: TimeSchedule = {
        employee_id: selectedId,
        weekday_minutes: week,
        tolerance_minutes: form.useDefault ? null : Math.max(0, Math.min(60, Number(form.tolerance) || 0)),
        bank_start_date: form.bank_start_date || null,
      };
      await TimesheetService.saveSchedule(schedule);
      flash({ type: 'success', text: 'Jornada salva.' });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const defSummary = def
    ? `${def.start_time && def.end_time ? `${def.start_time} às ${def.end_time}${def.break_minutes ? ` (intervalo ${def.break_minutes} min)` : ''} · ` : ''}` +
      `${fmtMinutes(def.weekday_minutes.reduce((s, m) => s + m, 0))} semanais · tolerância ${def.tolerance_minutes} min`
    : '';

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 h-fit">
        <h3 className="font-bold text-slate-800">Início do controle de ponto</h3>
        <p className="text-xs text-slate-500">
          Dias antes desta data não contam no espelho nem no banco de horas, assim quem já trabalhava não começa com faltas.
          Para quem foi admitido depois, vale a data de admissão.
        </p>
        <input type="date" value={startDate} disabled={!canEdit} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        {canEdit && (
          <button onClick={saveStart} disabled={busy || !startDate || startDate === savedStart} className={btnPrimary}>Salvar início</button>
        )}
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-slate-800">Jornada padrão</h3>
            <p className="text-xs text-slate-500">Vale para todos os funcionários que não têm jornada própria. {defSummary}</p>
          </div>
          {defForm && (
            <form onSubmit={saveDefault} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className={labelClass}>Entrada</label>
                  <input type="time" value={defForm.start} disabled={!canEdit} onChange={(e) => setDefForm({ ...defForm, start: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Saída</label>
                  <input type="time" value={defForm.end} disabled={!canEdit} onChange={(e) => setDefForm({ ...defForm, end: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Intervalo (min)</label>
                  <input type="number" min={0} max={600} value={defForm.brk} disabled={!canEdit} onChange={(e) => setDefForm({ ...defForm, brk: e.target.value })} className={inputClass} />
                </div>
                {canEdit && (
                  <button type="button" onClick={applyWeekdays} disabled={dayFromClock === null} className={btn}>
                    Aplicar {dayFromClock !== null ? fmtMinutes(dayFromClock) : ''} seg–sex
                  </button>
                )}
              </div>
              <WeekInputs week={defForm.week} disabled={!canEdit} onChange={(week) => setDefForm({ ...defForm, week })} />
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-end gap-4">
                  <div>
                    <label className={labelClass}>Tolerância diária (min)</label>
                    <input type="number" min={0} max={60} value={defForm.tolerance} disabled={!canEdit} onChange={(e) => setDefForm({ ...defForm, tolerance: e.target.value })} className={`${inputClass} w-32`} />
                  </div>
                  <p className="text-xs text-slate-600 pb-2">Total semanal: <strong className="tabular-nums">{fmtMinutes(weekSum(defForm.week))}</strong></p>
                </div>
                {canEdit && <button type="submit" disabled={busy} className={btnPrimary}>Salvar padrão</button>}
              </div>
            </form>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Jornada por funcionário</h3>
          <EmployeeSelect employees={employees} value={selectedId} onChange={setSelectedId} />
          {form && def && (
            <form onSubmit={save} className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox" checked={form.useDefault} disabled={!canEdit}
                  onChange={(e) => setForm({
                    ...form, useDefault: e.target.checked,
                    ...(e.target.checked ? { week: weekText(def.weekday_minutes), tolerance: String(def.tolerance_minutes) } : {}),
                  })}
                />
                Seguir a jornada padrão
              </label>
              <WeekInputs week={form.week} disabled={!canEdit || form.useDefault} onChange={(week) => setForm({ ...form, week })} />
              <p className="text-xs text-slate-600">Total semanal: <strong className="tabular-nums">{fmtMinutes(weekSum(form.week))}</strong></p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tolerância diária (min)</label>
                  <input type="number" min={0} max={60} value={form.tolerance} disabled={!canEdit || form.useDefault} onChange={(e) => setForm({ ...form, tolerance: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Início próprio do controle</label>
                  <input type="date" value={form.bank_start_date} disabled={!canEdit} onChange={(e) => setForm({ ...form, bank_start_date: e.target.value })} className={inputClass} />
                  <span className="text-[11px] text-slate-400">Vazio = início geral ({formatDate(savedStart)}) ou admissão.</span>
                </div>
              </div>
              {canEdit && (
                <div className="flex justify-end">
                  <button type="submit" disabled={busy} className={btnPrimary}>Salvar jornada</button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------- Feriados ----------------

const HolidaysTab: React.FC<{ canEdit: boolean; flash: (f: Feedback) => void }> = ({ canEdit, flash }) => {
  const [year, setYear] = useState(Number(todayISO().slice(0, 4)));
  const [rows, setRows] = useState<TimeHoliday[]>([]);
  const [form, setForm] = useState<TimeHoliday>({ holiday_date: '', name: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await TimesheetService.holidays(year));
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await TimesheetService.saveHoliday(form);
      setForm({ holiday_date: '', name: '' });
      if (Number(form.holiday_date.slice(0, 4)) !== year) setYear(Number(form.holiday_date.slice(0, 4)));
      else await load();
      flash({ type: 'success', text: 'Feriado salvo.' });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (h: TimeHoliday) => {
    if (!window.confirm(`Excluir o feriado ${h.name} (${formatDate(h.holiday_date)})?`)) return;
    try {
      await TimesheetService.deleteHoliday(h.holiday_date);
      await load();
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {canEdit && (
        <form onSubmit={save} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 h-fit">
          <h3 className="font-bold text-slate-800">Incluir feriado</h3>
          <p className="text-xs text-slate-500">Inclua feriados estaduais, municipais e pontos facultativos (ex.: Carnaval, Corpus Christi). Em feriado o dia não tem horas previstas.</p>
          <div>
            <label className={labelClass}>Data</label>
            <input type="date" required value={form.holiday_date} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Nome</label>
            <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </div>
          <button type="submit" disabled={busy} className={btnPrimary}><Plus className="w-4 h-4" /> Salvar</button>
        </form>
      )}
      <div className={`${canEdit ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-slate-200 shadow-sm`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Feriados de {year}</h3>
          <div className="flex gap-1">
            <button onClick={() => setYear(year - 1)} className={btn}>{year - 1}</button>
            <button onClick={() => setYear(year + 1)} className={btn}>{year + 1}</button>
          </div>
        </div>
        <ul className="divide-y divide-slate-100">
          {rows.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nenhum feriado cadastrado em {year}.</li>}
          {rows.map((h) => {
            const wd = new Date(`${h.holiday_date}T12:00:00`).getDay();
            return (
              <li key={h.holiday_date} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="font-semibold tabular-nums text-slate-700 w-24">{formatDate(h.holiday_date)}</span>
                <span className="text-xs text-slate-400 w-10">{WEEKDAY_SHORT[wd]}</span>
                <span className="text-slate-700 flex-1">{h.name}</span>
                {canEdit && (
                  <button onClick={() => remove(h)} className="text-slate-400 hover:text-rose-600" aria-label="Excluir feriado"><Trash2 className="w-4 h-4" /></button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

// ---------------- Responsáveis por departamento ----------------

const ManagersTab: React.FC<{ employees: EmployeeOption[]; canEdit: boolean; flash: (f: Feedback) => void }> = ({ employees, canEdit, flash }) => {
  const [rows, setRows] = useState<DepartmentManager[]>([]);
  const [candidates, setCandidates] = useState<ManagerCandidate[]>([]);
  const [adding, setAdding] = useState<Record<string, { userId: string; approve: boolean }>>({});
  const [busy, setBusy] = useState(false);

  const departments = useMemo(
    () => Array.from(new Set(employees.filter((e) => e.status !== 'desligado').map((e) => e.department_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [employees],
  );
  const headcount = (d: string) => employees.filter((e) => e.department_name === d && e.status !== 'desligado').length;

  const load = useCallback(async () => {
    try {
      setRows(await TimesheetService.departmentManagers());
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    if (canEdit) TimesheetService.managerCandidates().then(setCandidates).catch((e) => flash({ type: 'error', text: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, canEdit]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
      flash({ type: 'success', text: ok });
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const add = (dep: string) => {
    const a = adding[dep];
    if (!a?.userId) return;
    const person = candidates.find((c) => c.id === a.userId);
    run(async () => {
      await TimesheetService.addManager(dep, a.userId, a.approve);
      setAdding({ ...adding, [dep]: { userId: '', approve: true } });
    }, `${person?.full_name || 'Pessoa'} agora é responsável por ${dep}.`);
  };

  // Departamentos que só existem na lista de responsáveis (ex.: renomeados) também aparecem
  const allDeps = Array.from(new Set([...departments, ...rows.map((r) => r.department_name)])).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-sm text-slate-600 space-y-1">
        <p>
          O <strong>responsável</strong> (gestor) vê o resumo, os espelhos e os pedidos só dos funcionários do departamento.
          Com <strong>Aprova</strong> marcado, também aprova ou recusa os pedidos da equipe. Ele não muda jornadas, feriados, marcações nem banco de horas.
        </p>
        <p className="text-xs text-slate-500">
          Uma pessoa pode ser responsável por vários departamentos, e um departamento pode ter vários responsáveis.
          Ninguém aprova o próprio pedido: os pedidos do responsável vão para o RH. A pessoa precisa ter login no ERP (qualquer perfil, inclusive Funcionário).
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {allDeps.map((dep) => {
          const list = rows.filter((r) => r.department_name === dep);
          const taken = new Set(list.map((r) => r.user_id));
          const a = adding[dep] || { userId: '', approve: true };
          return (
            <div key={dep} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold text-slate-800">{dep}</h3>
                <span className="text-xs text-slate-500">{headcount(dep)} funcionário(s)</span>
              </div>
              <ul className="space-y-1.5">
                {list.length === 0 && <li className="text-xs text-slate-400">Sem responsável: só o RH acompanha.</li>}
                {list.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold truncate ${m.is_active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{m.full_name || m.email || 'Usuário removido'}</div>
                      <div className="text-[11px] text-slate-400 truncate">{m.email}{!m.is_active && ' · inativo'}</div>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-slate-600 shrink-0" title="Pode aprovar ou recusar pedidos da equipe">
                      <input
                        type="checkbox" checked={m.can_approve} disabled={!canEdit || busy}
                        onChange={(e) => run(() => TimesheetService.setManagerApprove(dep, m.user_id, e.target.checked), e.target.checked ? 'Agora pode aprovar.' : 'Agora só visualiza.')}
                      />
                      Aprova
                    </label>
                    {canEdit && (
                      <button
                        disabled={busy}
                        onClick={() => window.confirm(`Tirar ${m.full_name || m.email} de responsável por ${dep}?`) && run(() => TimesheetService.removeManager(dep, m.user_id), 'Responsável removido.')}
                        className="text-slate-400 hover:text-rose-600 shrink-0" aria-label="Remover responsável"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <select
                    value={a.userId} onChange={(e) => setAdding({ ...adding, [dep]: { ...a, userId: e.target.value } })}
                    className="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white" aria-label={`Novo responsável por ${dep}`}
                  >
                    <option value="">Incluir responsável...</option>
                    {candidates.filter((c) => !taken.has(c.id)).map((c) => (
                      <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input type="checkbox" checked={a.approve} onChange={(e) => setAdding({ ...adding, [dep]: { ...a, approve: e.target.checked } })} />
                    Aprova
                  </label>
                  <button onClick={() => add(dep)} disabled={!a.userId || busy} className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40" aria-label="Incluir">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {allDeps.length === 0 && <p className="text-sm text-slate-500">Nenhum departamento encontrado no cadastro de funcionários.</p>}
      </div>
    </div>
  );
};
