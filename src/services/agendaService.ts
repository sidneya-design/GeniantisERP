import { supabase } from '../lib/supabase';
import { ModuleKey } from '../types';
import { NotificationService } from './notificationService';
import { callEmailFunction } from './emailService';

// ---------------- Datas (AAAA-MM-DD, sem fuso) ----------------

const toUTC = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};
const fromUTC = (dt: Date) => dt.toISOString().slice(0, 10);

export const addDays = (d: string, n: number) => {
  const dt = toUTC(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
};
export const addMonths = (d: string, n: number) => {
  const [y, m] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return fromUTC(dt);
};
export const diffDays = (a: string, b: string) => Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86400000);
export const weekday = (d: string) => toUTC(d).getUTCDay();
export const startOfWeek = (d: string) => addDays(d, -weekday(d));
export const startOfMonth = (d: string) => `${d.slice(0, 7)}-01`;
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/** Minutos desde 00:00 no horário de Brasília */
export const nowMinutes = () => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const [h, m] = p.split(':').map(Number);
  return h * 60 + m;
};

export const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
  toUTC(d).toLocaleDateString('pt-BR', { ...opts, timeZone: 'UTC' });

export const timeToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const minToTime = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/** "09:00" → "9h", "09:30" → "9h30" */
/** Link de videochamada válido (https) */
export const isMeetingUrl = (u: string) => /^https:\/\/\S+$/i.test(u.trim());
/** Opções de lembrete (minutos antes). Dia inteiro: conta a partir das 8h do dia */
export const REMINDER_OPTIONS_TIMED: { value: number; label: string }[] = [
  { value: 0, label: 'Na hora' },
  { value: 10, label: '10 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 1440, label: '1 dia antes' },
  { value: 10080, label: '1 semana antes' },
];
export const REMINDER_OPTIONS_ALLDAY: { value: number; label: string }[] = [
  { value: 0, label: 'No dia, às 8h' },
  { value: 1440, label: '1 dia antes, às 8h' },
  { value: 2880, label: '2 dias antes, às 8h' },
  { value: 10080, label: '1 semana antes, às 8h' },
];
export const reminderLabel = (min: number | null | undefined, allDay: boolean) => {
  if (min === null || min === undefined) return null;
  const list = allDay ? REMINDER_OPTIONS_ALLDAY : REMINDER_OPTIONS_TIMED;
  return list.find((o) => o.value === min)?.label || `${min} minutos antes`;
};

/** E-mails digitados no campo de convidados de fora */
export const externalEmails = (t: string | null | undefined) =>
  [...new Set((String(t || '').match(/[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']+/g) || []).map((e) => e.toLowerCase().replace(/[.]+$/, '')))];
export const isGoogleMeet = (u: string) => /^https:\/\/meet\.google\.com\//i.test(u.trim());

/** Duração em texto curto: 30 min, 1h, 1h30 */
export const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

/** Duração de um item com horário no mesmo dia (minutos), ou null */
export const itemDuration = (i: { date: string; endDate: string; startTime?: string; endTime?: string }): number | null =>
  i.startTime && i.endTime && i.date === i.endDate ? Math.max(0, timeToMin(i.endTime) - timeToMin(i.startTime)) : null;

export const fmtTime = (t: string) => {
  const [h, m] = t.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
};

// ---------------- Cores ----------------

/** Paleta pronta; a pessoa também pode escolher qualquer cor (#RRGGBB) */
export const PRESET_COLORS: { key: string; label: string; hex: string }[] = [
  { key: 'azul', label: 'Azul', hex: '#2563eb' },
  { key: 'verde', label: 'Verde', hex: '#059669' },
  { key: 'vermelho', label: 'Vermelho', hex: '#e11d48' },
  { key: 'laranja', label: 'Laranja', hex: '#f97316' },
  { key: 'amarelo', label: 'Amarelo', hex: '#f59e0b' },
  { key: 'roxo', label: 'Roxo', hex: '#7c3aed' },
  { key: 'rosa', label: 'Rosa', hex: '#ec4899' },
  { key: 'turquesa', label: 'Turquesa', hex: '#0d9488' },
  { key: 'cinza', label: 'Cinza', hex: '#64748b' },
];

const HEX_RE = /^#[0-9a-f]{6}$/i;
export const isHex = (c: string | null | undefined): c is string => !!c && HEX_RE.test(c);

/** Cor (nome da paleta ou #RRGGBB) para hexadecimal */
export const colorHex = (c: string | null | undefined, fallback = '#2563eb'): string => {
  if (isHex(c)) return c.toLowerCase();
  return PRESET_COLORS.find((p) => p.key === c)?.hex || fallback;
};

/** Texto legível sobre a cor (branco ou quase preto) */
export const textOn = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#1e293b' : '#ffffff';
};

/** Estilo de um bloco preenchido com a cor */
export const fillStyle = (c: string | null | undefined) => {
  const hex = colorHex(c);
  return { backgroundColor: hex, color: textOn(hex) };
};

// ---------------- Camadas (agendas que se ligam e desligam) ----------------

/** Datas que vêm dos outros módulos (os eventos ficam nas agendas de cada pessoa) */
export type SystemLayer = 'vencimentos' | 'aniversarios' | 'tempo_casa' | 'feriados' | 'ausencias' | 'manutencoes';

export const SYSTEM_LAYERS: { key: SystemLayer; label: string; color: string; modules: ModuleKey[] }[] = [
  { key: 'vencimentos', label: 'Vencimentos', color: 'vermelho', modules: ['domains', 'subscriptions', 'suppliers', 'assets'] },
  { key: 'aniversarios', label: 'Aniversários', color: 'rosa', modules: ['birthdays', 'employees'] },
  { key: 'tempo_casa', label: 'Tempo de casa', color: 'roxo', modules: ['employees'] },
  { key: 'feriados', label: 'Feriados', color: 'verde', modules: ['agenda'] },
  { key: 'ausencias', label: 'Férias e folgas', color: 'turquesa', modules: ['timesheet'] },
  { key: 'manutencoes', label: 'Manutenções', color: 'laranja', modules: ['maintenance'] },
];

/** Camada de um item: "cal:<id da agenda>", "convites" ou uma camada do sistema */
export type LayerKey = string;
export const calLayer = (id: string) => `cal:${id}`;
export const INVITES_LAYER = 'convites';

// ---------------- Agendas e usuários ----------------

export interface AgendaCalendar {
  id: string;
  name: string;
  description: string | null;
  color: string;
  owner_id: string | null;
  owner_name: string | null;
  is_personal: boolean;
  is_public: boolean;
  /** Nível da pessoa logada: 1 ver, 2 editar eventos, 3 gerenciar */
  level: 1 | 2 | 3;
}

export interface AgendaUser {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface CalendarMember {
  calendar_id: string;
  user_id: string;
  level: 1 | 2 | 3;
}

export const SHARE_LEVEL_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Ver eventos',
  2: 'Editar eventos',
  3: 'Gerenciar agenda',
};

export type GuestResponse = 'pendente' | 'sim' | 'nao' | 'talvez';
export const RESPONSE_LABEL: Record<GuestResponse, string> = { pendente: 'Aguardando', sim: 'Sim', nao: 'Não', talvez: 'Talvez' };

export type TaskStatus = 'nao_iniciado' | 'fazendo' | 'finalizado';
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  nao_iniciado: 'Não iniciado',
  fazendo: 'Fazendo',
  finalizado: 'Finalizado',
};
export const TASK_STATUS_ORDER: TaskStatus[] = ['nao_iniciado', 'fazendo', 'finalizado'];

/** Nome dado a uma cor (ex.: ADM = verde), só da pessoa logada */
export interface ColorLabel {
  color: string;
  name: string;
}
/** Filtro por etiqueta: "cor:#rrggbb" ou "cor:outras" (cores sem etiqueta) */
export const colorFilterKey = (hex: string, labels: ColorLabel[]) =>
  labels.some((l) => l.color === hex) ? `cor:${hex}` : 'cor:outras';

export interface EventGuest {
  user_id: string;
  response: GuestResponse;
}

// ---------------- Eventos ----------------

export type Recurrence = 'nenhuma' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'anual';

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  nenhuma: 'Não se repete',
  diaria: 'Todos os dias',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal (a cada 2 semanas)',
  mensal: 'Mensal',
  anual: 'Anual',
};

export interface AgendaEvent {
  id: string;
  calendar_id: string;
  /** evento = compromisso; atividade = tarefa com situação e responsável */
  kind: 'evento' | 'atividade';
  status: TaskStatus | null;
  /** Usuário responsável pela atividade */
  assignee_id: string | null;
  completed_at: string | null;
  title: string;
  description: string | null;
  location: string | null;
  /** Vazio = cor da agenda */
  color: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  recurrence: Recurrence;
  recurrence_until: string | null;
  responsible_employee_id: string | null;
  guests: string | null;
  /** Link de videochamada (Google Meet, Zoom, Teams…) */
  meeting_url?: string | null;
  /** Minutos antes para o lembrete (0 = na hora; dia inteiro conta das 8h). Vazio = sem lembrete */
  reminder_minutes?: number | null;
  /** Atividade sem avisos (nem ao responsável, nem lembrete) */
  muted?: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  agenda_event_guests?: EventGuest[];
}

export type AgendaEventInput = Omit<AgendaEvent, 'id' | 'created_by' | 'created_at' | 'updated_at' | 'agenda_event_guests' | 'completed_at'>;

/** Um item na tela: ocorrência de evento ou data vinda de outro módulo */
export interface AgendaItem {
  key: string;
  layer: LayerKey;
  title: string;
  /** Primeiro e último dia (iguais quando é um dia só) */
  date: string;
  endDate: string;
  /** Com horário: "HH:MM" (só eventos) */
  startTime?: string;
  endTime?: string;
  /** Nome da paleta ou #RRGGBB */
  color: string;
  subtitle?: string;
  /** Tela do módulo de origem */
  link?: string;
  event?: AgendaEvent;
}

const MISSING = 'A agenda ainda não foi ativada no banco. Rode as migrations 20261123000041_agenda.sql e 20261123000042_agenda_sharing.sql no Supabase.';
const friendly = (m: string) =>
  /agenda_|calendar_id/.test(m) && /exist|schema cache|not find|Could not find/i.test(m)
    ? MISSING
    : /agenda_events_kind_check/.test(m)
      ? 'Rode a migration 20261123000051_event_status.sql no Supabase para os eventos terem situação.'
    : /reminder_minutes/.test(m)
      ? 'Rode a migration 20261123000049_agenda_reminders.sql no Supabase para usar os lembretes.'
    : /muted|notify_activities/.test(m)
      ? 'Rode a migration 20261124000052_notify_activities.sql no Supabase para usar a opção Não notificar.'
    : /meeting_url/.test(m)
      ? 'Rode a migration 20261123000047_agenda_meeting_link.sql no Supabase para salvar o link da videochamada.'
    : /row-level security/i.test(m)
      ? 'Você não tem permissão para fazer isso nesta agenda. Peça a quem gerencia a agenda (ou ao Admin) para ajustar seu acesso.'
      : m;

/** Ocorrências de um evento (com repetição) que tocam o intervalo [from, to] */
export function expandEvent(ev: AgendaEvent, from: string, to: string, calendar?: AgendaCalendar): AgendaItem[] {
  const span = diffDays(ev.start_date, ev.end_date);
  const until = ev.recurrence_until && ev.recurrence_until < to ? ev.recurrence_until : to;
  const out: AgendaItem[] = [];
  const push = (start: string) => {
    const end = addDays(start, span);
    if (end < from || start > to) return;
    out.push({
      key: `ev-${ev.id}-${start}`,
      layer: calendar ? calLayer(calendar.id) : INVITES_LAYER,
      title: ev.title,
      date: start,
      endDate: end,
      startTime: ev.start_time?.slice(0, 5),
      endTime: ev.end_time?.slice(0, 5),
      color: ev.color || calendar?.color || 'azul',
      subtitle: ev.location || undefined,
      event: ev,
    });
  };

  if (ev.recurrence === 'nenhuma') {
    push(ev.start_date);
    return out;
  }
  const [sy, sm, sd] = ev.start_date.split('-').map(Number);
  // Diária e semanal: começa perto do intervalo, sem percorrer desde o início da série
  const step = ev.recurrence === 'diaria' ? 1 : ev.recurrence === 'semanal' ? 7 : ev.recurrence === 'quinzenal' ? 14 : 0;
  const first = step ? Math.max(0, Math.floor((diffDays(ev.start_date, from) - span) / step)) : 0;
  for (let i = first; i < first + 1000; i++) {
    let start: string | null;
    if (ev.recurrence === 'diaria') start = addDays(ev.start_date, i);
    else if (ev.recurrence === 'semanal') start = addDays(ev.start_date, i * 7);
    else if (ev.recurrence === 'quinzenal') start = addDays(ev.start_date, i * 14);
    else if (ev.recurrence === 'mensal') {
      const y = sy + Math.floor((sm - 1 + i) / 12);
      const m = ((sm - 1 + i) % 12) + 1;
      start = sd <= daysInMonth(y, m) ? `${y}-${String(m).padStart(2, '0')}-${String(sd).padStart(2, '0')}` : null;
      if (`${y}-${String(m).padStart(2, '0')}-01` > until) break;
    } else {
      const y = sy + i;
      start = sd <= daysInMonth(y, sm) ? `${y}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}` : null;
      if (`${y}-01-01` > until) break;
    }
    if (!start) continue;
    if (start > until) break;
    // Pula rápido as ocorrências bem antes do intervalo
    if (addDays(start, span) < from) continue;
    push(start);
  }
  return out;
}

/** Situação de cada ocorrência das atividades que se repetem: chave "id|AAAA-MM-DD" */
export type OccurrenceMap = Map<string, { status: TaskStatus; completed_at: string | null }>;
/** Evento ou atividade que se repete: a situação é de cada repetição */
export const isRecurringTask = (ev?: AgendaEvent) => !!ev && ev.recurrence !== 'nenhuma';

/** Cada ocorrência de atividade que se repete recebe a situação do próprio dia (sem registro = não iniciado) */
export function applyOccurrences(items: AgendaItem[], occ: OccurrenceMap): AgendaItem[] {
  return items.map((it) => {
    if (!isRecurringTask(it.event)) return it;
    const o = occ.get(`${it.event!.id}|${it.date}`);
    return { ...it, event: { ...it.event!, status: o?.status || 'nao_iniciado', completed_at: o?.completed_at || null } };
  });
}

async function loadOccurrences(ids: string[], from: string, to: string): Promise<OccurrenceMap> {
  const map: OccurrenceMap = new Map();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from('agenda_task_occurrences')
    .select('event_id, occurrence_date, status, completed_at')
    .in('event_id', ids)
    .gte('occurrence_date', from)
    .lte('occurrence_date', to);
  if (error) {
    if (/agenda_task_occurrences/.test(error.message)) return map; // migration 046 ainda não rodou
    throw error;
  }
  for (const o of data || []) map.set(`${o.event_id}|${o.occurrence_date}`, { status: o.status, completed_at: o.completed_at });
  return map;
}

/** Datas anuais (aniversário, tempo de casa) dentro do intervalo */
function yearlyDates(base: string, from: string, to: string): { date: string; years: number }[] {
  const [by, bm, bd] = base.split('-').map(Number);
  const out: { date: string; years: number }[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    // 29/02 cai em 28/02 nos anos sem 29
    const day = Math.min(bd, daysInMonth(y, bm));
    const d = `${y}-${String(bm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (d >= from && d <= to && y >= by) out.push({ date: d, years: y - by });
  }
  return out;
}

const ABSENCE_LABEL: Record<string, string> = {
  ferias: 'Férias',
  folga: 'Folga abonada',
  folga_banco: 'Folga do banco',
  atestado: 'Atestado',
  falta_justificada: 'Falta justificada',
};

const EVENT_SELECT = '*, agenda_event_guests(user_id, response)';

export interface LoadResult {
  items: AgendaItem[];
  /** Agendas que não puderam ser carregadas (ex.: tabela ainda não criada) */
  warnings: string[];
}

export const AgendaService = {
  /** Tudo o que aparece no intervalo, só das agendas liberadas para a pessoa */
  async load(from: string, to: string, can: (m: ModuleKey) => boolean, calendars: AgendaCalendar[]): Promise<LoadResult> {
    const calById = new Map(calendars.map((c) => [c.id, c]));
    const items: AgendaItem[] = [];
    const warnings: string[] = [];
    const tasks: Promise<void>[] = [];
    const run = (label: string, fn: () => Promise<void>) =>
      tasks.push(fn().catch((e) => { warnings.push(`${label}: ${friendly(e?.message || String(e))}`); }));

    if (can('agenda')) {
      run('Eventos', async () => {
        const [single, recurring] = await Promise.all([
          supabase.from('agenda_events').select(EVENT_SELECT).eq('recurrence', 'nenhuma').lte('start_date', to).gte('end_date', from),
          supabase.from('agenda_events').select(EVENT_SELECT).neq('recurrence', 'nenhuma').lte('start_date', to),
        ]);
        if (single.error) throw single.error;
        if (recurring.error) throw recurring.error;
        const evs: AgendaItem[] = [];
        const all = [...(single.data || []), ...(recurring.data || [])] as AgendaEvent[];
        for (const ev of all) {
          if (ev.recurrence_until && ev.recurrence_until < from) continue;
          evs.push(...expandEvent(ev, from, to, calById.get(ev.calendar_id)));
        }
        const occ = await loadOccurrences(all.filter(isRecurringTask).map((e) => e.id), from, to);
        items.push(...applyOccurrences(evs, occ));
      });
      run('Feriados', async () => {
        const { data, error } = await supabase.from('time_holidays').select('holiday_date, name').gte('holiday_date', from).lte('holiday_date', to);
        if (error) {
          if (/time_holidays/.test(error.message)) return; // Ponto ainda não instalado: sem feriados
          throw error;
        }
        for (const h of data || []) {
          items.push({ key: `fer-${h.holiday_date}`, layer: 'feriados', title: h.name, date: h.holiday_date, endDate: h.holiday_date, color: 'verde', subtitle: 'Feriado' });
        }
      });
    }

    if (can('domains')) {
      run('Domínios', async () => {
        const { data, error } = await supabase.from('domains').select('id, domain, expiration_date, status').eq('status', 'ativo').gte('expiration_date', from).lte('expiration_date', to);
        if (error) throw error;
        for (const d of data || []) {
          items.push({ key: `dom-${d.id}`, layer: 'vencimentos', title: `Vence o domínio ${d.domain}`, date: d.expiration_date, endDate: d.expiration_date, color: 'vermelho', subtitle: 'Domínios & Renovações', link: '/dominios' });
        }
      });
    }
    if (can('subscriptions')) {
      run('Assinaturas', async () => {
        const { data, error } = await supabase.from('subscriptions').select('id, service_name, renewal_date, status').eq('status', 'ativa').gte('renewal_date', from).lte('renewal_date', to);
        if (error) throw error;
        for (const s of data || []) {
          items.push({ key: `sub-${s.id}`, layer: 'vencimentos', title: `Renova ${s.service_name}`, date: s.renewal_date, endDate: s.renewal_date, color: 'vermelho', subtitle: 'Assinaturas & Licenças', link: '/assinaturas' });
        }
      });
    }
    if (can('suppliers')) {
      run('Contratos', async () => {
        const { data, error } = await supabase.from('supplier_contracts').select('id, name, end_date, status, suppliers(name)').eq('status', 'vigente').gte('end_date', from).lte('end_date', to);
        if (error) throw error;
        for (const c of (data || []) as any[]) {
          const supplier = Array.isArray(c.suppliers) ? c.suppliers[0]?.name : c.suppliers?.name;
          items.push({ key: `ctr-${c.id}`, layer: 'vencimentos', title: `Fim do contrato ${c.name}`, date: c.end_date, endDate: c.end_date, color: 'vermelho', subtitle: supplier ? `Fornecedor: ${supplier}` : 'Fornecedores & Contratos', link: '/fornecedores' });
        }
      });
    }
    if (can('assets')) {
      run('Garantias', async () => {
        const { data, error } = await supabase.from('assets').select('id, patrimony, brand, model, warranty_until, status').neq('status', 'baixado').gte('warranty_until', from).lte('warranty_until', to);
        if (error) throw error;
        for (const a of data || []) {
          const name = [a.brand, a.model].filter(Boolean).join(' ');
          items.push({ key: `gar-${a.id}`, layer: 'vencimentos', title: `Fim da garantia ${a.patrimony}${name ? ` (${name})` : ''}`, date: a.warranty_until, endDate: a.warranty_until, color: 'vermelho', subtitle: 'Ativos de TI', link: '/ativos' });
        }
      });
    }
    if (can('maintenance')) {
      run('Manutenções', async () => {
        const { data, error } = await supabase.from('maintenance_orders').select('id, issue, forecast_date, status, assets(patrimony)').eq('status', 'em_andamento').gte('forecast_date', from).lte('forecast_date', to);
        if (error) throw error;
        for (const m of (data || []) as any[]) {
          const pat = Array.isArray(m.assets) ? m.assets[0]?.patrimony : m.assets?.patrimony;
          items.push({ key: `man-${m.id}`, layer: 'manutencoes', title: `Previsão de retorno${pat ? ` do ${pat}` : ''}`, date: m.forecast_date, endDate: m.forecast_date, color: 'laranja', subtitle: m.issue, link: '/manutencoes' });
        }
      });
    }
    if (can('birthdays') || can('employees')) {
      run('Funcionários', async () => {
        const { data, error } = await supabase.from('employees').select('id, full_name, preferential_name, birth_date, admission_date, status, department_name').neq('status', 'desligado');
        if (error) throw error;
        for (const e of data || []) {
          const name = e.preferential_name || e.full_name;
          if (e.birth_date) {
            for (const o of yearlyDates(e.birth_date, from, to)) {
              items.push({ key: `niver-${e.id}-${o.date}`, layer: 'aniversarios', title: `Aniversário de ${name}`, date: o.date, endDate: o.date, color: 'rosa', subtitle: e.department_name || undefined, link: can('birthdays') ? '/aniversariantes' : '/funcionarios' });
            }
          }
          if (e.admission_date && can('employees')) {
            for (const o of yearlyDates(e.admission_date, from, to)) {
              if (o.years < 1) continue;
              items.push({ key: `casa-${e.id}-${o.date}`, layer: 'tempo_casa', title: `${name}: ${o.years} ano${o.years > 1 ? 's' : ''} de casa`, date: o.date, endDate: o.date, color: 'roxo', subtitle: e.department_name || undefined, link: '/funcionarios' });
            }
          }
        }
      });
    }
    if (can('timesheet')) {
      run('Férias e folgas', async () => {
        const { data, error } = await supabase.from('time_requests').select('id, kind, start_date, end_date, status, employees(full_name)').eq('status', 'aprovado').neq('kind', 'ajuste').lte('start_date', to).gte('end_date', from);
        if (error) throw error;
        for (const r of (data || []) as any[]) {
          const name = Array.isArray(r.employees) ? r.employees[0]?.full_name : r.employees?.full_name;
          items.push({ key: `aus-${r.id}`, layer: 'ausencias', title: `${ABSENCE_LABEL[r.kind] || r.kind}${name ? `: ${name}` : ''}`, date: r.start_date, endDate: r.end_date, color: 'turquesa', subtitle: 'Controle de Ponto', link: '/ponto' });
        }
      });
    }

    await Promise.all(tasks);
    return { items, warnings };
  },

  /** Funcionários ativos para escolher o responsável */
  async employees(): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase.from('employees').select('id, full_name').neq('status', 'desligado').order('full_name');
    if (error) return [];
    return data || [];
  },

  // ----- Agendas -----

  /** Agendas que a pessoa vê (cria a pessoal na primeira vez) */
  async calendars(): Promise<AgendaCalendar[]> {
    const ensure = await supabase.rpc('agenda_ensure_personal');
    if (ensure.error) throw new Error(friendly(ensure.error.message));
    const { data, error } = await supabase.rpc('agenda_my_calendars');
    if (error) throw new Error(friendly(error.message));
    return (data || []) as AgendaCalendar[];
  },

  async saveCalendar(input: { id?: string; name: string; description: string | null; color: string; is_public?: boolean }): Promise<AgendaCalendar> {
    const row = { name: input.name.trim(), description: input.description, color: input.color, ...(input.is_public !== undefined ? { is_public: input.is_public } : {}) };
    if (input.id) {
      const { data, error } = await supabase.from('agenda_calendars').update(row).eq('id', input.id).select().single();
      if (error) throw new Error(friendly(error.message));
      return data as AgendaCalendar;
    }
    // Agenda nova: o código é gerado aqui e o registro não é pedido de volta. Pedir de volta
    // fazia o banco conferir o acesso antes de "enxergar" a agenda recém-criada e recusar.
    const id = crypto.randomUUID();
    const ownerId = (await supabase.auth.getSession()).data.session?.user.id || null;
    const { error } = await supabase.from('agenda_calendars').insert({ id, ...row, owner_id: ownerId });
    if (error) throw new Error(friendly(error.message));
    return {
      id, name: row.name, description: row.description, color: row.color, owner_id: ownerId, owner_name: null,
      is_personal: false, is_public: !!input.is_public, level: 3,
    };
  },

  async deleteCalendar(id: string): Promise<void> {
    const { error, count } = await supabase.from('agenda_calendars').delete({ count: 'exact' }).eq('id', id);
    if (error) throw new Error(friendly(error.message));
    if (count === 0) throw new Error('Só quem criou a agenda (ou o Admin) pode excluí-la.');
  },

  async members(calendarId: string): Promise<CalendarMember[]> {
    const { data, error } = await supabase.from('agenda_calendar_members').select('calendar_id, user_id, level').eq('calendar_id', calendarId);
    if (error) throw new Error(friendly(error.message));
    return (data || []) as CalendarMember[];
  },

  async setMember(calendarId: string, userId: string, level: 1 | 2 | 3): Promise<void> {
    const { error } = await supabase.from('agenda_calendar_members').upsert({ calendar_id: calendarId, user_id: userId, level }, { onConflict: 'calendar_id,user_id' });
    if (error) throw new Error(friendly(error.message));
    NotificationService.flushEmails();
  },

  async removeMember(calendarId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('agenda_calendar_members').delete().eq('calendar_id', calendarId).eq('user_id', userId);
    if (error) throw new Error(friendly(error.message));
  },

  // ----- Etiquetas de cor -----

  async colorLabels(): Promise<ColorLabel[]> {
    const { data, error } = await supabase.from('agenda_color_labels').select('color, name').order('name');
    if (error) return [];
    return (data || []) as ColorLabel[];
  },

  /**
   * Cria ou renomeia; trocar a cor de uma etiqueta move o nome para a cor nova.
   * Com `recolorEvents`, os eventos que a pessoa criou com a cor antiga passam para a nova.
   * Devolve quantos eventos foram recoloridos.
   */
  async saveColorLabel(color: string, name: string, previousColor?: string, recolorEvents = false): Promise<number> {
    const hex = colorHex(color);
    let recolored = 0;
    if (recolorEvents && previousColor && previousColor !== hex) {
      recolored = await this.recolorMyEvents(previousColor, hex);
    }
    if (previousColor && previousColor !== hex) {
      const { error } = await supabase.from('agenda_color_labels').delete().eq('color', previousColor);
      if (error) throw new Error(friendly(error.message));
    }
    const userId = (await supabase.auth.getSession()).data.session?.user.id;
    const { error } = await supabase.from('agenda_color_labels').upsert({ user_id: userId, color: hex, name: name.trim() }, { onConflict: 'user_id,color' });
    if (error) {
      if (/user_id|on conflict|ON CONFLICT/i.test(error.message)) {
        throw new Error('Rode a migration 20261123000045_color_labels_per_user.sql no Supabase para as etiquetas ficarem só suas.');
      }
      if (/agenda_color_labels/.test(error.message) && /exist|schema cache|not find/i.test(error.message)) {
        throw new Error('Rode a migration 20261123000044_notifications_color_labels.sql no Supabase para usar as etiquetas.');
      }
      throw new Error(friendly(error.message));
    }
    return recolored;
  },

  /** Troca a cor dos eventos criados pela pessoa logada (a cor pode estar como #hex ou nome da paleta) */
  async recolorMyEvents(fromColor: string, toColor: string): Promise<number> {
    const from = colorHex(fromColor);
    const to = colorHex(toColor);
    const userId = (await supabase.auth.getSession()).data.session?.user.id;
    if (!userId || from === to) return 0;
    const { data, error } = await supabase
      .from('agenda_events')
      .select('id, color')
      .eq('created_by', userId)
      .not('color', 'is', null);
    if (error) throw new Error(friendly(error.message));
    const ids = (data || []).filter((e: { color: string | null }) => colorHex(e.color, '') === from).map((e: { id: string }) => e.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { error: upErr } = await supabase.from('agenda_events').update({ color: to }).in('id', ids.slice(i, i + 200));
      if (upErr) throw new Error(friendly(upErr.message));
    }
    return ids.length;
  },

  async deleteColorLabel(color: string): Promise<void> {
    const { error } = await supabase.from('agenda_color_labels').delete().eq('color', color);
    if (error) throw new Error(friendly(error.message));
  },

  /** Usuários ativos, para compartilhar e convidar */
  async users(): Promise<AgendaUser[]> {
    const { data, error } = await supabase.rpc('agenda_users');
    if (error) return [];
    return (data || []) as AgendaUser[];
  },

  // ----- Eventos -----

  async create(input: AgendaEventInput, guests: string[]): Promise<AgendaEvent> {
    const { data, error } = await supabase.from('agenda_events').insert(input).select().single();
    if (error) throw new Error(friendly(error.message));
    await this.syncGuests(data.id, [], guests);
    NotificationService.flushEmails();
    return data as AgendaEvent;
  },

  async update(id: string, input: AgendaEventInput, before: string[], guests: string[]): Promise<AgendaEvent> {
    const { data, error } = await supabase.from('agenda_events').update(input).eq('id', id).select().single();
    if (error) throw new Error(friendly(error.message));
    await this.syncGuests(id, before, guests);
    NotificationService.flushEmails();
    return data as AgendaEvent;
  },

  async syncGuests(eventId: string, before: string[], after: string[]): Promise<void> {
    const add = after.filter((u) => !before.includes(u));
    const del = before.filter((u) => !after.includes(u));
    if (add.length) {
      const { error } = await supabase.from('agenda_event_guests').insert(add.map((user_id) => ({ event_id: eventId, user_id })));
      if (error) throw new Error(`Evento salvo, mas os convidados não: ${friendly(error.message)}`);
    }
    if (del.length) {
      const { error } = await supabase.from('agenda_event_guests').delete().eq('event_id', eventId).in('user_id', del);
      if (error) throw new Error(`Evento salvo, mas os convidados não: ${friendly(error.message)}`);
    }
  },

  /** Atividades para acompanhamento: todas em aberto + finalizadas nos últimos 30 dias */
  async activities(calendars: AgendaCalendar[]): Promise<AgendaItem[]> {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data, error } = await supabase
      .from('agenda_events')
      .select(EVENT_SELECT)
      .eq('kind', 'atividade')
      .or(`status.neq.finalizado,completed_at.gte.${since}`)
      .order('start_date')
      .limit(1000);
    if (error) throw new Error(friendly(error.message));
    const calById = new Map(calendars.map((c) => [c.id, c]));
    const evs = (data || []) as AgendaEvent[];
    const single = evs.filter((ev) => !isRecurringTask(ev)).flatMap((ev) => expandEvent(ev, ev.start_date, ev.end_date, calById.get(ev.calendar_id)));

    // Que se repetem: atrasadas dos últimos 30 dias, a de hoje, a próxima e as finalizadas da última semana
    const today = todayKey();
    const from = addDays(today, -30);
    const to = addDays(today, 400);
    const recurringEvs = evs.filter(isRecurringTask).filter((ev) => !ev.recurrence_until || ev.recurrence_until >= from);
    const occ = await loadOccurrences(recurringEvs.map((e) => e.id), from, today);
    const recurring: AgendaItem[] = [];
    for (const ev of recurringEvs) {
      const all = applyOccurrences(expandEvent(ev, from, to, calById.get(ev.calendar_id)), occ);
      const past = all.filter((i) => i.date <= today);
      const next = all.find((i) => i.date > today);
      const weekAgo = addDays(today, -7);
      recurring.push(
        ...past.filter((i) => i.event!.status !== 'finalizado' || i.date >= weekAgo),
        ...(next && !past.some((i) => i.date === today && i.event!.status !== 'finalizado') ? [next] : []),
      );
    }
    return [...single, ...recurring];
  },

  // ----- Convidados de fora do ERP (convite por e-mail) -----

  /** Para quem o convite por e-mail já foi enviado */
  async externalInvites(eventId: string): Promise<{ email: string; sent_at: string }[]> {
    const { data, error } = await supabase.from('agenda_external_invites').select('email, sent_at').eq('event_id', eventId);
    if (error) return [];
    return data || [];
  },

  /** Envia o convite aos e-mails de fora digitados no evento (cada um recebe uma vez; resend = todos de novo) */
  async sendExternalInvites(eventId: string, resend = false): Promise<{ enviados: number; ja_enviados: number; falhas: number }> {
    try {
      return await callEmailFunction({ action: 'agenda_external_invite', event_id: eventId, resend });
    } catch (e: any) {
      const m = e?.message || '';
      if (/agenda_external_invites/.test(m)) throw new Error('Rode a migration 20261123000048_agenda_external_invites.sql no Supabase para enviar convites a quem é de fora.');
      if (/indisponível neste ambiente/i.test(m)) throw new Error('Os convites por e-mail só saem pelo site publicado (no localhost as funções de e-mail não rodam).');
      throw e;
    }
  },

  /** Muda a situação de uma atividade (responsável ou quem edita a agenda) */
  async setStatus(eventId: string, status: TaskStatus, date?: string): Promise<void> {
    const { error } = await supabase.rpc('agenda_set_status', { p_event: eventId, p_status: status, ...(date ? { p_date: date } : {}) });
    if (error) throw new Error(friendly(error.message));
  },

  async respond(eventId: string, response: Exclude<GuestResponse, 'pendente'>): Promise<void> {
    const { error } = await supabase.rpc('agenda_respond', { p_event: eventId, p_response: response });
    if (error) throw new Error(friendly(error.message));
  },

  async remove(id: string): Promise<void> {
    const { error, count } = await supabase.from('agenda_events').delete({ count: 'exact' }).eq('id', id);
    if (error) throw new Error(friendly(error.message));
    if (count === 0) throw new Error('Você não pode excluir eventos desta agenda.');
  },
};
