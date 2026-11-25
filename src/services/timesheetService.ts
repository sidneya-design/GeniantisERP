import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { todayISO } from './subscriptionService';

// ---------- Tipos ----------

export type TimeRequestKind = 'ajuste' | 'ferias' | 'folga' | 'folga_banco' | 'atestado' | 'falta_justificada';
export type TimeRequestStatus = 'pendente' | 'aprovado' | 'recusado' | 'cancelado';
export type DayStatus = 'futuro' | 'hoje' | 'incompleto' | 'ausencia' | 'feriado' | 'folga' | 'falta' | 'normal';

export interface TimeProfile {
  employee_id: string;
  full_name: string;
  department: string;
  role_title: string;
  admission_date: string;
  status: string;
  weekday_minutes: number[];
  tolerance_minutes: number;
  bank_start_date: string;
}

export interface TimePunch {
  id: string;
  employee_id: string;
  punched_at: string;
  work_date: string;
  source: 'ponto' | 'ajuste' | 'manual';
  note: string | null;
  created_at: string;
  /** Localização no momento da batida (só no ponto batido pelo funcionário) */
  latitude?: number | null;
  longitude?: number | null;
  accuracy_m?: number | null;
  location_status?: 'ok' | 'negada' | 'indisponivel' | null;
}

export type PunchLocation =
  | { status: 'ok'; latitude: number; longitude: number; accuracy: number }
  | { status: 'negada' | 'indisponivel' };

/** Pede a localização ao navegador (até 10 s). Nunca impede o ponto: sem localização, devolve o motivo */
export function getPunchLocation(timeoutMs = 10000): Promise<PunchLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve({ status: 'indisponivel' });
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ status: 'indisponivel' }), timeoutMs + 1000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ status: 'ok', latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      (err) => {
        clearTimeout(timer);
        resolve({ status: err.code === err.PERMISSION_DENIED ? 'negada' : 'indisponivel' });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

export const punchMapUrl = (p: Pick<TimePunch, 'latitude' | 'longitude'>) =>
  p.latitude != null && p.longitude != null ? `https://www.google.com/maps?q=${p.latitude},${p.longitude}` : null;

export interface TimeDay {
  work_date: string;
  weekday: number;
  expected_minutes: number;
  worked_minutes: number;
  punches: string[];
  holiday: string | null;
  absence: TimeRequestKind | null;
  status: DayStatus;
  /** null = dia ainda não encerrado (hoje/futuro) */
  balance_minutes: number | null;
}

export interface TimeBank {
  start_date: string;
  days_minutes: number;
  entries_minutes: number;
  total_minutes: number;
}

export interface TimeRequest {
  id: string;
  employee_id: string;
  kind: TimeRequestKind;
  start_date: string;
  end_date: string;
  punch_time: string | null;
  reason: string;
  status: TimeRequestStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  employee_name?: string;
  employee_department?: string;
}

export interface TimeSchedule {
  employee_id: string;
  /** null = segue a jornada padrão */
  weekday_minutes: number[] | null;
  /** null = segue a tolerância padrão */
  tolerance_minutes: number | null;
  bank_start_date: string | null;
}

/** Jornada padrão (Configuração geral) */
export interface DefaultSchedule {
  weekday_minutes: number[];
  tolerance_minutes: number;
  /** Horário de referência (só para mostrar/preencher; o cálculo usa os minutos por dia) */
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
}

export interface TimeHoliday {
  holiday_date: string;
  name: string;
}

export interface TimeBankEntry {
  id: string;
  employee_id: string;
  entry_date: string;
  minutes: number;
  reason: string;
  created_at: string;
}

export interface TimeOverviewRow {
  employee_id: string;
  full_name: string;
  department: string;
  status: string;
  expected_minutes: number;
  worked_minutes: number;
  period_balance: number;
  absences: number;
  incomplete_days: number;
  bank_total: number;
  pending_requests: number;
}

export interface ManagedDepartment {
  department_name: string;
  can_approve: boolean;
}

export interface DepartmentManager {
  department_name: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  can_approve: boolean;
  is_active: boolean;
}

export interface ManagerCandidate {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export interface EmployeeOption {
  id: string;
  full_name: string;
  department_name: string;
  status: string;
}

// ---------- Rótulos e formatação ----------

export const DEFAULT_WEEK = [0, 480, 480, 480, 480, 480, 0];
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const KIND_LABEL: Record<TimeRequestKind, string> = {
  ajuste: 'Ajuste de marcação',
  ferias: 'Férias',
  folga: 'Folga abonada',
  folga_banco: 'Folga do banco de horas',
  atestado: 'Atestado médico',
  falta_justificada: 'Falta justificada',
};

/** O que cada tipo faz com o dia (mostrado nos formulários) */
export const KIND_HELP: Record<TimeRequestKind, string> = {
  ajuste: 'Inclui uma marcação que você esqueceu de bater.',
  ferias: 'Dias de férias não contam como previstos.',
  folga: 'Folga concedida pela empresa: não desconta do banco.',
  folga_banco: 'Dia de folga descontado do seu banco de horas.',
  atestado: 'Dias de atestado não contam como previstos.',
  falta_justificada: 'Falta abonada: não desconta do banco.',
};

export const REQUEST_STATUS: Record<TimeRequestStatus, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  aprovado: { label: 'Aprovado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  recusado: { label: 'Recusado', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export const DAY_STATUS: Record<DayStatus, { label: string; cls: string }> = {
  normal: { label: 'Normal', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  incompleto: { label: 'Incompleto', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  falta: { label: 'Falta', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  ausencia: { label: 'Ausência', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  feriado: { label: 'Feriado', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  folga: { label: 'Folga', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  hoje: { label: 'Hoje', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  futuro: { label: '—', cls: 'bg-white text-slate-400 border-slate-200' },
};

/** Nome da marcação pela posição no dia */
export function punchLabel(index: number): string {
  const names = ['Entrada', 'Saída almoço', 'Volta almoço', 'Saída'];
  if (index < 4) return names[index];
  return index % 2 === 0 ? 'Entrada extra' : 'Saída extra';
}

/** 528 -> "8h48"; -30 -> "-0h30" */
export function fmtMinutes(min: number | null | undefined, signed = false): string {
  if (min === null || min === undefined) return '—';
  const neg = min < 0;
  const abs = Math.abs(Math.round(min));
  const txt = `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
  if (neg) return `-${txt}`;
  return signed && abs > 0 ? `+${txt}` : txt;
}

/** "8:48" ou "8h48" -> 528 */
export function parseMinutes(text: string): number | null {
  const m = text.trim().match(/^(-)?\s*(\d{1,3})\s*(?:[:h]\s*(\d{1,2}))?\s*(?:m(?:in)?)?$/i);
  if (!m) return null;
  const mins = Number(m[2]) * 60 + Number(m[3] || 0);
  if (m[3] && Number(m[3]) > 59) return null;
  return m[1] ? -mins : mins;
}

/** Horário (HH:MM) no fuso de Brasília */
export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function balanceClass(min: number | null | undefined): string {
  if (!min) return 'text-slate-500';
  return min > 0 ? 'text-emerald-600' : 'text-rose-600';
}

/** Primeiro e último dia do mês (YYYY-MM) */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export const currentMonthKey = () => todayISO().slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const s = new Date(`${month}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Converte data + hora de Brasília para ISO (Brasília não tem horário de verão desde 2019) */
export function brasiliaToISO(date: string, time: string): string {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}-03:00`).toISOString();
}

// ---------- Acesso ao banco ----------

function fail(error: { message: string; code?: string } | null): never {
  const msg = error?.message || 'Erro desconhecido.';
  if (error?.code === '42P01' || error?.code === 'PGRST202' || /does not exist|schema cache|Could not find the function/i.test(msg)) {
    throw new Error('Parte do controle de ponto ainda não existe no Supabase. Rode as migrations do ponto (20261119000035 a 20261119000039), na ordem.');
  }
  throw new Error(msg);
}

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('O controle de ponto precisa do Supabase configurado (arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).');
  }
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export const TimesheetService = {
  // ----- Funcionário -----

  async myProfile(): Promise<TimeProfile | null> {
    ensureConfigured();
    const { data, error } = await supabase.rpc('my_time_profile');
    if (error) fail(error);
    const row = (data as any[])?.[0];
    return row ? { ...row, weekday_minutes: (row.weekday_minutes || DEFAULT_WEEK).map(Number) } : null;
  },

  async punch(note?: string, loc?: PunchLocation): Promise<TimePunch> {
    ensureConfigured();
    const args: Record<string, unknown> = { p_note: note || null };
    if (loc) {
      args.p_location_status = loc.status;
      if (loc.status === 'ok') Object.assign(args, { p_latitude: loc.latitude, p_longitude: loc.longitude, p_accuracy: loc.accuracy });
    }
    let { data, error } = await supabase.rpc('punch_clock', args);
    // Banco ainda sem a migration 050: registra o ponto sem localização
    if (error && loc && /punch_clock|function|parameter/i.test(error.message) && /find|exist|match/i.test(error.message)) {
      ({ data, error } = await supabase.rpc('punch_clock', { p_note: note || null }));
    }
    if (error) fail(error);
    return data as TimePunch;
  },

  async cancelRequest(id: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_time_request', { p_id: id });
    if (error) fail(error);
  },

  async createRequest(input: {
    employee_id: string; kind: TimeRequestKind; start_date: string; end_date: string;
    punch_time?: string | null; reason: string;
    /** RH lançando direto já aprovado (ex.: férias) */
    approved?: boolean;
  }): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Sessão expirada. Entre novamente.');
    const now = new Date().toISOString();
    const { error } = await supabase.from('time_requests').insert({
      employee_id: input.employee_id,
      kind: input.kind,
      start_date: input.start_date,
      end_date: input.kind === 'ajuste' ? input.start_date : input.end_date,
      punch_time: input.kind === 'ajuste' ? input.punch_time : null,
      reason: input.reason.trim(),
      created_by: uid,
      ...(input.approved ? { status: 'aprovado', reviewed_by: uid, reviewed_at: now } : {}),
    });
    if (error) fail(error);
  },

  // ----- Comuns (funcionário vê só os próprios; RH vê todos) -----

  async daily(employeeId: string, from: string, to: string): Promise<TimeDay[]> {
    ensureConfigured();
    const { data, error } = await supabase.rpc('time_daily', { p_employee: employeeId, p_from: from, p_to: to });
    if (error) fail(error);
    return ((data as any[]) || []).map((r) => ({
      ...r,
      weekday: Number(r.weekday),
      expected_minutes: num(r.expected_minutes),
      worked_minutes: num(r.worked_minutes),
      punches: r.punches || [],
      balance_minutes: r.balance_minutes === null ? null : Number(r.balance_minutes),
    }));
  },

  async bank(employeeId: string): Promise<TimeBank> {
    ensureConfigured();
    const { data, error } = await supabase.rpc('time_bank_balance', { p_employee: employeeId });
    if (error) fail(error);
    const r = (data as any[])?.[0] || {};
    return {
      start_date: r.start_date,
      days_minutes: num(r.days_minutes),
      entries_minutes: num(r.entries_minutes),
      total_minutes: num(r.total_minutes),
    };
  },

  async punches(employeeId: string, from: string, to: string): Promise<TimePunch[]> {
    const { data, error } = await supabase
      .from('time_punches')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('work_date', from)
      .lte('work_date', to)
      .order('punched_at');
    if (error) fail(error);
    return (data || []) as TimePunch[];
  },

  async requests(filter: { employeeId?: string; status?: TimeRequestStatus; limit?: number } = {}): Promise<TimeRequest[]> {
    ensureConfigured();
    let q = supabase
      .from('time_requests')
      .select('*, employees(full_name, department_name)')
      .order('created_at', { ascending: false })
      .limit(filter.limit ?? 200);
    if (filter.employeeId) q = q.eq('employee_id', filter.employeeId);
    if (filter.status) q = q.eq('status', filter.status);
    const { data, error } = await q;
    if (error) {
      // O funcionário não lê a tabela de funcionários: busca sem o nome
      if (/employees/i.test(error.message)) {
        let q2 = supabase.from('time_requests').select('*').order('created_at', { ascending: false }).limit(filter.limit ?? 200);
        if (filter.employeeId) q2 = q2.eq('employee_id', filter.employeeId);
        if (filter.status) q2 = q2.eq('status', filter.status);
        const r2 = await q2;
        if (r2.error) fail(r2.error);
        return (r2.data || []) as TimeRequest[];
      }
      fail(error);
    }
    return (data || []).map((r: any) => ({
      ...r, employee_name: r.employees?.full_name, employee_department: r.employees?.department_name, employees: undefined,
    }));
  },

  async bankEntries(employeeId: string): Promise<TimeBankEntry[]> {
    const { data, error } = await supabase
      .from('time_bank_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .order('entry_date', { ascending: false });
    if (error) fail(error);
    return (data || []) as TimeBankEntry[];
  },

  async holidays(year?: number): Promise<TimeHoliday[]> {
    let q = supabase.from('time_holidays').select('holiday_date, name').order('holiday_date');
    if (year) q = q.gte('holiday_date', `${year}-01-01`).lte('holiday_date', `${year}-12-31`);
    const { data, error } = await q;
    if (error) fail(error);
    return (data || []) as TimeHoliday[];
  },

  // ----- Responsáveis por departamento -----

  /** Departamentos de que a pessoa logada é responsável (vazio se não for, ou se a migration não rodou) */
  async myManagedDepartments(): Promise<ManagedDepartment[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.rpc('my_managed_departments');
    if (error) return [];
    return (data || []) as ManagedDepartment[];
  },

  async departmentManagers(): Promise<DepartmentManager[]> {
    const { data, error } = await supabase.rpc('time_department_managers_list');
    if (error) fail(error);
    return (data || []) as DepartmentManager[];
  },

  async managerCandidates(): Promise<ManagerCandidate[]> {
    const { data, error } = await supabase.rpc('time_manager_candidates');
    if (error) fail(error);
    return (data || []) as ManagerCandidate[];
  },

  async addManager(department: string, userId: string, canApprove: boolean): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('time_department_managers').upsert({
      department_name: department, user_id: userId, can_approve: canApprove, created_by: auth.user?.id,
    });
    if (error) fail(error);
  },

  async setManagerApprove(department: string, userId: string, canApprove: boolean): Promise<void> {
    const { error } = await supabase
      .from('time_department_managers')
      .update({ can_approve: canApprove })
      .eq('department_name', department)
      .eq('user_id', userId);
    if (error) fail(error);
  },

  async removeManager(department: string, userId: string): Promise<void> {
    const { error } = await supabase.from('time_department_managers').delete().eq('department_name', department).eq('user_id', userId);
    if (error) fail(error);
  },

  // ----- RH / gestão -----

  async overview(from: string, to: string): Promise<TimeOverviewRow[]> {
    ensureConfigured();
    const { data, error } = await supabase.rpc('time_overview', { p_from: from, p_to: to });
    if (error) fail(error);
    return ((data as any[]) || []).map((r) => ({
      ...r,
      expected_minutes: num(r.expected_minutes),
      worked_minutes: num(r.worked_minutes),
      period_balance: num(r.period_balance),
      absences: num(r.absences),
      incomplete_days: num(r.incomplete_days),
      bank_total: num(r.bank_total),
      pending_requests: num(r.pending_requests),
    }));
  },

  async employees(): Promise<EmployeeOption[]> {
    ensureConfigured();
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, department_name, status')
      .order('full_name');
    if (error) fail(error);
    return (data || []) as EmployeeOption[];
  },

  async review(id: string, approve: boolean, note?: string): Promise<void> {
    const { error } = await supabase.rpc('review_time_request', { p_id: id, p_approve: approve, p_note: note || null });
    if (error) fail(error);
  },

  async addManualPunch(employeeId: string, date: string, time: string, note: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('time_punches').insert({
      employee_id: employeeId,
      punched_at: brasiliaToISO(date, time),
      source: 'manual',
      note: note.trim() || null,
      created_by: auth.user?.id,
    });
    if (error) fail(error);
  },

  async updatePunch(id: string, date: string, time: string, note: string): Promise<void> {
    const { error } = await supabase
      .from('time_punches')
      .update({ punched_at: brasiliaToISO(date, time), note: note.trim() || null })
      .eq('id', id);
    if (error) fail(error);
  },

  async deletePunch(id: string): Promise<void> {
    const { error } = await supabase.from('time_punches').delete().eq('id', id);
    if (error) fail(error);
  },

  async schedule(employeeId: string): Promise<TimeSchedule | null> {
    const { data, error } = await supabase.from('time_schedules').select('*').eq('employee_id', employeeId).maybeSingle();
    if (error) fail(error);
    return data
      ? {
          ...data,
          weekday_minutes: data.weekday_minutes ? data.weekday_minutes.map(Number) : null,
          tolerance_minutes: data.tolerance_minutes === null ? null : Number(data.tolerance_minutes),
        }
      : null;
  },

  async saveSchedule(s: TimeSchedule): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('time_schedules').upsert({
      employee_id: s.employee_id,
      weekday_minutes: s.weekday_minutes,
      tolerance_minutes: s.tolerance_minutes,
      bank_start_date: s.bank_start_date || null,
      updated_by: auth.user?.id,
      updated_at: new Date().toISOString(),
    });
    if (error) fail(error);
  },

  async addBankEntry(employeeId: string, date: string, minutes: number, reason: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('time_bank_entries').insert({
      employee_id: employeeId, entry_date: date, minutes, reason: reason.trim(), created_by: auth.user?.id,
    });
    if (error) fail(error);
  },

  async deleteBankEntry(id: string): Promise<void> {
    const { error } = await supabase.from('time_bank_entries').delete().eq('id', id);
    if (error) fail(error);
  },

  async saveHoliday(h: TimeHoliday): Promise<void> {
    const { error } = await supabase.from('time_holidays').upsert({ holiday_date: h.holiday_date, name: h.name.trim() });
    if (error) fail(error);
  },

  async deleteHoliday(date: string): Promise<void> {
    const { error } = await supabase.from('time_holidays').delete().eq('holiday_date', date);
    if (error) fail(error);
  },

  async startDate(): Promise<string> {
    const { data, error } = await supabase.from('time_settings').select('start_date').eq('id', 1).maybeSingle();
    if (error) fail(error);
    return data?.start_date || todayISO();
  },

  async defaultSchedule(): Promise<DefaultSchedule> {
    const { data, error } = await supabase
      .from('time_settings')
      .select('default_weekday_minutes, default_tolerance_minutes, default_start_time, default_end_time, default_break_minutes')
      .eq('id', 1)
      .maybeSingle();
    if (error) fail(error);
    return {
      weekday_minutes: (data?.default_weekday_minutes || DEFAULT_WEEK).map(Number),
      tolerance_minutes: Number(data?.default_tolerance_minutes ?? 10),
      start_time: data?.default_start_time?.slice(0, 5) || null,
      end_time: data?.default_end_time?.slice(0, 5) || null,
      break_minutes: data?.default_break_minutes === null || data?.default_break_minutes === undefined ? null : Number(data.default_break_minutes),
    };
  },

  async saveDefaultSchedule(d: DefaultSchedule): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('time_settings')
      .update({
        default_weekday_minutes: d.weekday_minutes,
        default_tolerance_minutes: d.tolerance_minutes,
        default_start_time: d.start_time || null,
        default_end_time: d.end_time || null,
        default_break_minutes: d.break_minutes,
        updated_by: auth.user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    if (error) fail(error);
  },

  async saveStartDate(date: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('time_settings')
      .update({ start_date: date, updated_by: auth.user?.id, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) fail(error);
  },
};
