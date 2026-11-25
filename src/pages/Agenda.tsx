import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, AlignLeft, CalendarDays, CheckSquare, Clock, ExternalLink, Loader2, MapPin, PanelLeft, Pencil, Plus, Repeat,
  BellRing, ChevronDown, Info, Settings2, Trash2, User, Users, Video, X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../components/common/ConfirmDialog';
import { CalendarSettings, ColorLabelsEditor, ColorPicker, inputCls, Sheet, userLabel } from '../components/agenda/AgendaDialogs';
import { NotificationService } from '../services/notificationService';
import {
  ListView, MiniCalendar, MonthView, rangeOf, sortItems, TaskMark, TaskToggleContext, TimeGrid, titleOf, View, whenText,
} from '../components/agenda/AgendaViews';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../lib/usePermission';
import {
  addDays, addMonths, AgendaCalendar, AgendaEvent, AgendaEventInput, AgendaItem, AgendaService, AgendaUser, calLayer, ColorLabel, colorFilterKey, colorHex,
  diffDays, fillStyle, fmtDate, INVITES_LAYER, LayerKey, minToTime, fmtDuration, itemDuration, Recurrence, RECURRENCE_LABEL, RESPONSE_LABEL, startOfMonth,
  externalEmails, isGoogleMeet, isMeetingUrl, REMINDER_OPTIONS_ALLDAY, REMINDER_OPTIONS_TIMED, reminderLabel, isRecurringTask, startOfWeek, SYSTEM_LAYERS, TASK_STATUS_LABEL, TASK_STATUS_ORDER, TaskStatus, timeToMin, todayKey,
} from '../services/agendaService';

const VIEW_LABEL: Record<View, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês', lista: 'Programação', atividades: 'Atividades' };
const STORAGE_KEY = 'geniantis_agenda_prefs';

function readPrefs(): { view?: View; hidden?: string[]; weekends?: boolean; collapsed?: string[] } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
function writePrefs(p: { view: View; hidden: string[]; weekends: boolean; collapsed: string[] }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignora (navegação privada)
  }
}

function useIsMobile() {
  const query = '(max-width: 767px)';
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

const STATUS_CLS: Record<TaskStatus, string> = {
  nao_iniciado: 'bg-slate-100 text-slate-700 border-slate-300',
  fazendo: 'bg-amber-50 text-amber-800 border-amber-300',
  finalizado: 'bg-emerald-50 text-emerald-800 border-emerald-300',
};

// ---------------- Formulário ----------------

/** Rótulo pequeno acima de um campo do formulário */
const fieldLabelCls = 'block text-xs font-medium text-slate-600 min-w-0';

interface FormState {
  id?: string;
  kind: 'evento' | 'atividade';
  calendar_id: string;
  title: string;
  allDay: boolean;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  recurrence: Recurrence;
  recurrence_until: string;
  /** Nulo = cor da agenda */
  color: string | null;
  location: string;
  responsible_employee_id: string;
  guests: string;
  guestIds: string[];
  meeting_url: string;
  /** Já tinha link ao abrir (para conseguir apagar) */
  hadMeeting: boolean;
  /** Lembrete em minutos antes ('' = sem lembrete) */
  reminder: string;
  hadReminder: boolean;
  /** Atividade sem avisos */
  muted: boolean;
  hadMuted: boolean;
  originalGuests: string[];
  status: TaskStatus;
  assignee_id: string;
  description: string;
}

const newForm = (calendarId: string, date: string, time?: string, kind: 'evento' | 'atividade' = 'evento', me = ''): FormState => {
  const start = time || '09:00';
  return {
    kind, calendar_id: calendarId, title: '', allDay: !time, start_date: date, end_date: date, start_time: start,
    end_time: minToTime(Math.min(timeToMin(start) + 60, 23 * 60 + 59)), recurrence: 'nenhuma', recurrence_until: '', color: null,
    location: '', responsible_employee_id: '', guests: '', guestIds: [], meeting_url: '', hadMeeting: false, reminder: time ? '30' : '', hadReminder: false, muted: false, hadMuted: false, originalGuests: [], status: 'nao_iniciado',
    assignee_id: kind === 'atividade' ? me : '', description: '',
  };
};

const formFromEvent = (ev: AgendaEvent): FormState => {
  const guests = (ev.agenda_event_guests || []).map((g) => g.user_id);
  return {
    id: ev.id,
    kind: ev.kind || 'evento',
    calendar_id: ev.calendar_id,
    title: ev.title,
    allDay: !ev.start_time,
    start_date: ev.start_date,
    end_date: ev.end_date,
    start_time: ev.start_time?.slice(0, 5) || '09:00',
    end_time: ev.end_time?.slice(0, 5) || '10:00',
    recurrence: ev.recurrence,
    recurrence_until: ev.recurrence_until || '',
    color: ev.color || null,
    location: ev.location || '',
    responsible_employee_id: ev.responsible_employee_id || '',
    guests: ev.guests || '',
    meeting_url: ev.meeting_url || '',
    hadMeeting: !!ev.meeting_url,
    reminder: ev.reminder_minutes === null || ev.reminder_minutes === undefined ? '' : String(ev.reminder_minutes),
    hadReminder: ev.reminder_minutes !== null && ev.reminder_minutes !== undefined,
    muted: !!ev.muted,
    hadMuted: !!ev.muted,
    guestIds: guests,
    originalGuests: guests,
    status: ev.status || 'nao_iniciado',
    assignee_id: ev.assignee_id || '',
    description: ev.description || '',
  };
};

const toInput = (f: FormState): AgendaEventInput => {
  const task = f.kind === 'atividade';
  return {
    calendar_id: f.calendar_id,
    kind: f.kind,
    // Atividade que se repete: a situação é de cada dia (a da série fica "não iniciado")
    status: f.recurrence !== 'nenhuma' ? 'nao_iniciado' : f.status,
    assignee_id: task ? f.assignee_id || null : null,
    title: f.title.trim(),
    description: f.description.trim() || null,
    location: f.location.trim() || null,
    color: f.color,
    start_date: f.start_date,
    end_date: task ? f.start_date : f.end_date,
    start_time: f.allDay ? null : f.start_time,
    end_time: f.allDay ? null : f.end_time,
    recurrence: f.recurrence,
    recurrence_until: f.recurrence !== 'nenhuma' && f.recurrence_until ? f.recurrence_until : null,
    responsible_employee_id: task ? null : f.responsible_employee_id || null,
    guests: task ? null : f.guests.trim() || null,
    // Só manda o campo quando há link (ou para apagar um que existia): funciona antes da migration 047
    ...(!task && f.meeting_url.trim() ? { meeting_url: f.meeting_url.trim() } : f.hadMeeting ? { meeting_url: null } : {}),
    // Mesmo cuidado com o lembrete (funciona antes da migration 049 quando não há lembrete)
    ...(f.reminder !== '' && !(task && f.muted) ? { reminder_minutes: Number(f.reminder) } : f.hadReminder ? { reminder_minutes: null } : {}),
    // Só manda quando liga (ou para desligar): funciona antes da migration 052
    ...(task && f.muted ? { muted: true } : f.hadMuted ? { muted: false } : {}),
  };
};

// ---------------- Convidados (usuários do ERP) ----------------

const GuestPicker: React.FC<{ users: AgendaUser[]; value: string[]; meId?: string; onChange: (ids: string[]) => void }> = ({ users, value, meId, onChange }) => {
  const [q, setQ] = useState('');
  const byId = new Map(users.map((u) => [u.id, u]));
  const term = q.trim().toLowerCase();
  const matches = term
    ? users.filter((u) => u.id !== meId && !value.includes(u.id) && `${u.full_name || ''} ${u.email || ''}`.toLowerCase().includes(term)).slice(0, 6)
    : [];
  return (
    <div className="flex-1 min-w-0 space-y-2">
      <div className="relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Convidar usuários do ERP" className={inputCls} aria-label="Convidar usuários" />
        {matches.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {matches.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => { onChange([...value, u.id]); setQ(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{userLabel(u)}</span>
                  {u.email && u.full_name && <span className="text-slate-500"> · {u.email}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-slate-100 text-sm text-slate-700">
              {userLabel(byId.get(id))}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} className="p-0.5 rounded-full hover:bg-slate-200" aria-label={`Remover ${userLabel(byId.get(id))}`}><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------- Atividades (acompanhamento) ----------------

const ActivitiesBoard: React.FC<{
  items: AgendaItem[] | null; meId?: string; users: Map<string, AgendaUser>; calendars: Map<string, AgendaCalendar>;
  canChange: (ev: AgendaEvent) => boolean; onStatus: (ev: AgendaEvent, s: TaskStatus, date?: string) => void; onOpen: (i: AgendaItem) => void;
  onCreate?: () => void;
}> = ({ items, meId, users, calendars, canChange, onStatus, onOpen, onCreate }) => {
  const [mine, setMine] = useState(false);
  const today = todayKey();
  if (!items) return <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando atividades…</div>;
  const list = items.filter((i) => !mine || i.event?.assignee_id === meId);
  const late = (i: AgendaItem) => i.event?.status !== 'finalizado' && i.date < today;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex bg-white border border-slate-300 rounded-full p-0.5">
          {[false, true].map((m) => (
            <button key={String(m)} type="button" onClick={() => setMine(m)} className={`px-3.5 py-1 rounded-full text-sm font-semibold ${mine === m ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
              {m ? 'Minhas' : 'Todas'}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">{list.filter(late).length} atrasada(s) · finalizadas aparecem por 30 dias</span>
        {onCreate && <button type="button" onClick={onCreate} className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold"><Plus className="w-4 h-4" /> Atividade</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TASK_STATUS_ORDER.map((s) => {
          const col = list.filter((i) => i.event?.status === s).sort((a, b) => a.date.localeCompare(b.date));
          return (
            <div key={s} className="bg-slate-100/70 rounded-2xl p-2.5 space-y-2 min-w-0">
              <div className="flex items-center justify-between px-1">
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_CLS[s]}`}>{TASK_STATUS_LABEL[s]}</span>
                <span className="text-xs font-semibold text-slate-500">{col.length}</span>
              </div>
              {col.length === 0 && <p className="text-xs text-slate-400 px-1 py-3 text-center">Nenhuma atividade.</p>}
              {col.map((it) => {
                const ev = it.event!;
                const cal = calendars.get(ev.calendar_id);
                const idx = TASK_STATUS_ORDER.indexOf(s);
                return (
                  <div key={it.key} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <button type="button" onClick={() => onOpen(it)} className="w-full text-left p-3 flex gap-2.5">
                      <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: colorHex(it.color) }} />
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-start gap-2 text-sm font-semibold break-words ${s === 'finalizado' ? 'line-through text-slate-400' : 'text-slate-800'}`}><TaskMark item={it} size="lg" className="text-slate-400 mt-px" /><span className="min-w-0">{it.title}</span></span>
                        <span className={`block text-xs mt-0.5 ${late(it) ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                          {late(it) && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                          Prazo {fmtDate(it.date, { day: '2-digit', month: 'short' })}{it.startTime ? `, ${it.startTime}` : ''}
                          {itemDuration(it) ? <span className="text-slate-500 font-normal"> · {fmtDuration(itemDuration(it)!)}</span> : null}
                        </span>
                        <span className="block text-xs text-slate-500 truncate">
                          {ev.assignee_id ? userLabel(users.get(ev.assignee_id)) : 'Sem responsável'}{cal ? ` · ${cal.name}` : ''}
                        </span>
                      </span>
                    </button>
                    {canChange(ev) && (
                      <div className="flex border-t border-slate-100 text-xs font-semibold">
                        {idx > 0 && <button type="button" onClick={() => onStatus(ev, TASK_STATUS_ORDER[idx - 1], it.date)} className="flex-1 py-2 text-slate-500 hover:bg-slate-50">‹ {TASK_STATUS_LABEL[TASK_STATUS_ORDER[idx - 1]]}</button>}
                        {idx < 2 && <button type="button" onClick={() => onStatus(ev, TASK_STATUS_ORDER[idx + 1], it.date)} className="flex-1 py-2 text-blue-600 hover:bg-blue-50 border-l border-slate-100 first:border-l-0">{TASK_STATUS_LABEL[TASK_STATUS_ORDER[idx + 1]]} ›</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------- Página ----------------

export const Agenda: React.FC = () => {
  const { canAccess, profile } = useAuth();
  const { canDelete: agendaAdmin, canEdit: agendaEdit } = usePermission('agenda');
  const { confirm, dialog } = useConfirm();
  const mobile = useIsMobile();
  const prefs = useMemo(readPrefs, []);
  const meId = profile?.id;
  const [view, setView] = useState<View>(() => prefs.view || (mobile ? 'lista' : 'semana'));
  const [cursor, setCursor] = useState(todayKey());
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(prefs.hidden || []));
  // Fins de semana: desligado mostra só de segunda a sexta (Semana, Mês e Programação)
  const [weekends, setWeekends] = useState<boolean>(prefs.weekends ?? true);
  const [prefsOpen, setPrefsOpen] = useState(false);
  // Qual explicação (ⓘ) do painel está aberta
  const [infoOpen, setInfoOpen] = useState<string | null>(null);
  // Blocos do painel recolhidos pela setinha (Minhas agendas, Outras agendas, Datas do ERP)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(prefs.collapsed || []));
  const toggleSection = (k: string) => setCollapsed((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const [calendars, setCalendars] = useState<AgendaCalendar[] | null>(null);
  const [users, setUsers] = useState<AgendaUser[]>([]);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [activities, setActivities] = useState<AgendaItem[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [calReload, setCalReload] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [detail, setDetail] = useState<AgendaItem | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[] | null>(null);
  // Convites por e-mail já enviados (evento aberto nos detalhes)
  const [externalSent, setExternalSent] = useState<{ email: string; sent_at: string }[]>([]);
  const [inviteReload, setInviteReload] = useState(0);
  const [settings, setSettings] = useState<{ calendar: AgendaCalendar | null } | null>(null);
  // Etiquetas de cor (ADM = verde...) e o editor delas
  const [labels, setLabels] = useState<ColorLabel[]>([]);
  const [labelsOpen, setLabelsOpen] = useState(false);
  /** Etiqueta aberta direto na edição (cor) */
  const [labelEdit, setLabelEdit] = useState<string | undefined>(undefined);
  const [labelsReload, setLabelsReload] = useState(0);
  useEffect(() => { AgendaService.colorLabels().then(setLabels); }, [labelsReload]);
  const labelOf = (c: string | null | undefined) => labels.find((l) => l.color === colorHex(c));
  /** Esconde eventos/atividades das etiquetas de cor desligadas no painel */
  const colorHidden = (it: AgendaItem) => !!it.event && hidden.has(colorFilterKey(colorHex(it.color), labels));
  // Avisos por e-mail (preferência da pessoa)
  const [emailOn, setEmailOn] = useState<boolean | null>(null);
  useEffect(() => { if (profile?.id) NotificationService.emailEnabled(profile.id).then(setEmailOn).catch(() => setEmailOn(null)); }, [profile?.id]);
  const toggleEmail = async (on: boolean) => {
    if (!profile?.id) return;
    setEmailOn(on);
    try {
      await NotificationService.setEmailEnabled(profile.id, on);
    } catch (e: any) {
      setEmailOn(!on);
      setWarnings((w) => [...w, e.message]);
    }
  };
  // Avisos de atividades (atribuição e lembretes), preferência da pessoa
  const [activitiesOn, setActivitiesOn] = useState<boolean | null>(null);
  useEffect(() => { if (profile?.id) NotificationService.activitiesEnabled(profile.id).then(setActivitiesOn).catch(() => setActivitiesOn(true)); }, [profile?.id]);
  const toggleActivities = async (on: boolean) => {
    if (!profile?.id) return;
    setActivitiesOn(on);
    try {
      await NotificationService.setActivitiesEnabled(profile.id, on);
    } catch (e: any) {
      setActivitiesOn(!on);
      setWarnings((w) => [...w, e.message]);
    }
  };
  // Links dos avisos: /agenda?data=AAAA-MM-DD ou /agenda?visao=atividades
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const d = params.get('data');
    const v = params.get('visao');
    if (!d && !v) return;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { setCursor(d); setView(v === 'atividades' ? 'atividades' : 'dia'); }
    else if (v === 'atividades') setView('atividades');
    setParams({}, { replace: true });
  }, [params, setParams]);

  const range = useMemo(() => rangeOf(view, cursor), [view, cursor]);
  const calById = useMemo(() => new Map((calendars || []).map((c) => [c.id, c])), [calendars]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const writable = (calendars || []).filter((c) => c.level >= 2);
  const personal = (calendars || []).find((c) => c.is_personal && c.owner_id === meId);
  const defaultCal = personal && personal.level >= 2 ? personal : writable[0];
  const canCreate = !!defaultCal;

  useEffect(() => writePrefs({ view, hidden: [...hidden], weekends, collapsed: [...collapsed] }), [view, hidden, weekends, collapsed]);

  useEffect(() => {
    AgendaService.calendars()
      .then(setCalendars)
      .catch((e) => { setWarnings((w) => [...w, e.message]); setCalendars([]); });
  }, [calReload]);

  // Agendas compartilhadas com a pessoa depois que a página abriu: atualiza a lista quando a
  // janela volta ao foco e quando chega evento de uma agenda que ainda não está na lista
  useEffect(() => {
    const onFocus = () => { setCalReload((n) => n + 1); setReload((n) => n + 1); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  const [checkedUnknown, setCheckedUnknown] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!calendars) return;
    const known = new Set(calendars.map((c) => c.id));
    const unknown = [...new Set(items.filter((i) => i.event && !known.has(i.event.calendar_id)).map((i) => i.event!.calendar_id))]
      .filter((id) => !checkedUnknown.has(id));
    if (!unknown.length) return;
    setCheckedUnknown((s) => new Set([...s, ...unknown]));
    setCalReload((n) => n + 1);
  }, [items, calendars, checkedUnknown]);
  useEffect(() => { AgendaService.users().then(setUsers); }, []);

  useEffect(() => {
    if (!calendars) return;
    let alive = true;
    setLoading(true);
    AgendaService.load(range.from, range.to, canAccess, calendars)
      .then((r) => { if (alive) { setItems(r.items); setWarnings(r.warnings); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, reload, calendars]);

  useEffect(() => {
    if (view !== 'atividades' || !calendars) return;
    setActivities(null);
    AgendaService.activities(calendars).then(setActivities).catch((e) => { setWarnings((w) => [...w, e.message]); setActivities([]); });
  }, [view, reload, calendars]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const it of items) {
      if (hidden.has(it.layer) || colorHidden(it)) continue;
      const start = it.date < range.from ? range.from : it.date;
      const end = it.endDate > range.to ? range.to : it.endDate;
      for (let d = start; d <= end; d = addDays(d, 1)) map.set(d, [...(map.get(d) || []), it]);
    }
    map.forEach((l) => l.sort(sortItems));
    return map;
  }, [items, hidden, range, labels]);
  const itemsOn = useCallback((d: string) => byDay.get(d) || [], [byDay]);

  const move = (dir: -1 | 1) => {
    if (view === 'dia') setCursor(addDays(cursor, dir));
    else if (view === 'semana') setCursor(addDays(cursor, 7 * dir));
    else if (view === 'mes') setCursor(addMonths(startOfMonth(cursor), dir));
    else setCursor(addDays(cursor, 30 * dir));
  };
  const goDay = (d: string) => { setCursor(d); setView('dia'); };

  // Clique num horário ou dia sempre responde: abre o formulário ou explica por que não dá para criar
  const [notice, setNotice] = useState<string | null>(null);
  const openCreate = calendars
    ? (d: string, time?: string, kind: 'evento' | 'atividade' = 'evento') => {
        if (!defaultCal) {
          setNotice(
            calendars.length === 0
              ? 'Não foi possível carregar suas agendas. Se as migrations da agenda (20261123000041 e 20261123000042) ainda não rodaram no Supabase, rode e recarregue a página.'
              : 'Você só tem acesso de leitura às agendas que aparecem aqui. Peça a quem gerencia uma agenda para liberar "Editar eventos".'
          );
          return;
        }
        setNotice(null);
        setFormError(null);
        setForm(newForm(defaultCal.id, d, time, kind, meId));
      }
    : undefined;

  useEffect(() => {
    if ((form || detail?.event?.responsible_employee_id) && employees === null) AgendaService.employees().then(setEmployees);
  }, [form, detail, employees]);

  useEffect(() => {
    const id = detail?.event?.id;
    if (!id || !externalEmails(detail?.event?.guests).length) { setExternalSent([]); return; }
    AgendaService.externalInvites(id).then(setExternalSent);
  }, [detail?.event?.id, detail?.event?.guests, inviteReload]);

  const toggleLayer = (k: LayerKey) => setHidden((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const levelOf = (ev: AgendaEvent) => calById.get(ev.calendar_id)?.level ?? 0;
  const canEditEvent = (ev: AgendaEvent) => levelOf(ev) >= 2;
  const canChangeStatus = (ev: AgendaEvent) => (ev.kind === 'atividade' && ev.assignee_id === meId) || canEditEvent(ev);

  const refresh = () => setReload((n) => n + 1);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const task = form.kind === 'atividade';
    if (!form.title.trim()) { setFormError(task ? 'Dê um título à atividade.' : 'Dê um título ao evento.'); return; }
    if (!task && form.meeting_url.trim() && !isMeetingUrl(form.meeting_url)) { setFormError('O link da videochamada precisa começar com https://'); return; }
    if (!task && form.end_date < form.start_date) { setFormError('A data de término é antes do início.'); return; }
    if (!form.allDay && (task || form.end_date === form.start_date) && form.end_time <= form.start_time) { setFormError('O horário de término precisa ser depois do início.'); return; }
    if (!task && form.recurrence !== 'nenhuma' && form.recurrence_until && form.recurrence_until < form.start_date) { setFormError('A repetição termina antes do primeiro dia.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const guests = task ? [] : form.guestIds;
      const saved = form.id
        ? await AgendaService.update(form.id, toInput(form), form.originalGuests, guests)
        : await AgendaService.create(toInput(form), guests);
      // Convite por e-mail para quem é de fora do ERP (cada endereço recebe uma vez)
      if (!task && externalEmails(form.guests).length) sendInvites(saved.id, false);
      setForm(null);
      setDetail(null);
      refresh();
    } catch (err: any) {
      setFormError(err?.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const sendInvites = (eventId: string, resend: boolean) => {
    setNotice('Enviando convite por e-mail para os convidados de fora do ERP…');
    AgendaService.sendExternalInvites(eventId, resend)
      .then((r) => {
        setNotice(
          r.enviados
            ? `Convite enviado por e-mail para ${r.enviados} pessoa(s) de fora do ERP${r.falhas ? ` (${r.falhas} falhou)` : ''}.`
            : r.falhas ? `Não foi possível enviar ${r.falhas} convite(s). Veja os Logs.` : 'Os convidados de fora já tinham recebido o convite.'
        );
        setInviteReload((n) => n + 1);
      })
      .catch((e) => setNotice(e?.message || 'Não foi possível enviar os convites por e-mail.'));
  };

  const remove = async (ev: AgendaEvent) => {
    const what = ev.kind === 'atividade' ? 'a atividade' : 'o evento';
    const ok = await confirm({
      title: ev.kind === 'atividade' ? 'Excluir atividade?' : 'Excluir evento?',
      message: ev.recurrence !== 'nenhuma' ? `"${ev.title}" e todas as repetições serão excluídos.` : `Excluir ${what} "${ev.title}"?`,
      confirmLabel: 'Excluir',
      tone: 'rose',
    });
    if (!ok) return;
    try {
      await AgendaService.remove(ev.id);
      setDetail(null);
      refresh();
    } catch (err: any) {
      setWarnings((w) => [...w, err?.message || 'Não foi possível excluir.']);
    }
  };

  /** Muda a situação; na atividade que se repete, só a do dia (date) */
  const setStatus = async (ev: AgendaEvent, status: TaskStatus, date?: string) => {
    const recurring = isRecurringTask(ev);
    const same = (i: AgendaItem) => i.event?.id === ev.id && (!recurring || i.date === date);
    const patch = (i: AgendaItem) => (same(i) ? { ...i, event: { ...i.event!, status } } : i);
    setItems((l) => l.map(patch));
    setActivities((l) => (l ? l.map(patch) : l));
    setDetail((d) => (d && same(d) ? patch(d) : d));
    try {
      await AgendaService.setStatus(ev.id, status, recurring ? date : undefined);
      refresh();
    } catch (err: any) {
      // Desfaz na tela o que não foi gravado
      refresh();
      setWarnings((w) => [...w, /agenda_set_status|p_date|function/i.test(err?.message || '') && date
        ? 'Rode a migration 20261123000046_recurring_activities.sql no Supabase para marcar atividades que se repetem.'
        : err?.message || 'Não foi possível mudar a situação.']);
    }
  };

  // Caixinha da atividade: marca como finalizada ou reabre (volta para não iniciado)
  const toggleTask = (item: AgendaItem) => {
    const ev = item.event;
    if (!ev) return;
    if (!canChangeStatus(ev)) {
      setNotice(ev.kind === 'atividade' ? 'Só o responsável pela atividade ou quem edita a agenda pode marcar como finalizada.' : 'Só quem edita esta agenda pode marcar o evento como finalizado.');
      return;
    }
    const next: TaskStatus = ev.status === 'finalizado' ? 'nao_iniciado' : 'finalizado';
    // Atualiza na tela na hora (só este dia, se a atividade se repete); o banco confirma em seguida
    setStatus(ev, next, item.date);
  };

  const respond = async (ev: AgendaEvent, r: 'sim' | 'nao' | 'talvez') => {
    try {
      await AgendaService.respond(ev.id, r);
      const guests = (ev.agenda_event_guests || []).map((g) => (g.user_id === meId ? { ...g, response: r } : g));
      setDetail((d) => (d?.event?.id === ev.id ? { ...d, event: { ...d.event!, agenda_event_guests: guests } } : d));
      refresh();
    } catch (err: any) {
      setWarnings((w) => [...w, err?.message || 'Não foi possível responder.']);
    }
  };

  const weekDays = useMemo(() => {
    const s = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i)).filter((_, i) => weekends || (i > 0 && i < 6));
  }, [cursor, weekends]);

  const colorSuggestions = (calendars || []).map((c) => c.color);
  const mineCals = (calendars || []).filter((c) => c.owner_id === meId);
  const otherCals = (calendars || []).filter((c) => c.owner_id !== meId);
  const systemLayers = SYSTEM_LAYERS.filter((l) => l.modules.some((m) => canAccess(m)));
  const hasInvites = items.some((i) => i.layer === INVITES_LAYER);

  const LayerRow: React.FC<{ layer: LayerKey; label: string; color: string; sub?: string; onSettings?: () => void; settingsIcon?: 'edit' }> = ({ layer, label, color, sub, onSettings, settingsIcon }) => {
    const on = !hidden.has(layer);
    const hex = colorHex(color);
    return (
      <li className="group flex items-center rounded-lg hover:bg-slate-100">
        <label className="flex-1 min-w-0 flex items-center gap-2.5 px-1 py-1.5 cursor-pointer text-sm text-slate-700">
          <input type="checkbox" checked={on} onChange={() => toggleLayer(layer)} className="sr-only" />
          <span className="w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0" style={on ? { backgroundColor: hex, borderColor: hex } : { borderColor: hex }} aria-hidden="true">
            {on && <svg viewBox="0 0 12 12" className="w-3 h-3" style={{ color: fillStyle(hex).color }}><path d="M2.5 6.5l2.2 2.2L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span className="min-w-0">
            <span className="block truncate">{label}</span>
            {sub && <span className="block text-[11px] text-slate-400 truncate">{sub}</span>}
          </span>
        </label>
        {onSettings && (
          <button type="button" onClick={onSettings} className="p-1.5 mr-0.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100" aria-label={settingsIcon === 'edit' ? `Editar ${label}` : `Configurar ${label}`} title={settingsIcon === 'edit' ? 'Editar nome e cor' : undefined}>
            {settingsIcon === 'edit' ? <Pencil className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
          </button>
        )}
      </li>
    );
  };

  const calSub = (c: AgendaCalendar) => (c.is_personal ? (c.owner_id === meId ? 'Pessoal' : `Pessoal de ${c.owner_name || 'outra pessoa'}`) : c.is_public ? 'Aberta para todos' : c.owner_id === meId ? undefined : `de ${c.owner_name || 'Sistema'}`);

  const SectionHeader: React.FC<{ id: string; title: string; action?: React.ReactNode; info?: React.ReactNode }> = ({ id, title, action, info }) => {
    const open = !collapsed.has(id);
    const showInfo = infoOpen === id;
    return (
      <div className="mb-1">
        <div className="flex items-center justify-between px-1">
          <button type="button" onClick={() => toggleSection(id)} aria-expanded={open} className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 truncate">{title}</h3>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
          </button>
          {info && (
            <button
              type="button"
              onClick={() => setInfoOpen(showInfo ? null : id)}
              className={`p-1 ml-1 rounded-full hover:bg-slate-100 ${showInfo ? 'text-blue-600' : 'text-slate-400'}`}
              title={`O que é "${title}"?`}
              aria-label={`O que é "${title}"?`}
              aria-expanded={showInfo}
            >
              <Info className="w-4 h-4" />
            </button>
          )}
          {action}
        </div>
        {info && showInfo && (
          <div className="mt-1 mx-1 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900 leading-relaxed space-y-1">
            {info}
          </div>
        )}
      </div>
    );
  };

  const panel = (
    <div className="space-y-5">
      {canCreate && (
        <div className="flex gap-2">
          <button type="button" onClick={() => { setPanelOpen(false); openCreate?.(cursor); }} className="inline-flex items-center gap-2 pl-3 pr-5 py-3 rounded-2xl bg-white border border-slate-200 shadow-md hover:shadow-lg hover:bg-blue-50 text-sm font-semibold text-slate-700 transition-shadow">
            <Plus className="w-6 h-6 text-blue-600" /> Criar
          </button>
          <button type="button" onClick={() => { setPanelOpen(false); openCreate?.(cursor, undefined, 'atividade'); }} className="inline-flex items-center gap-1.5 px-3 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-600" title="Nova atividade">
            <CheckSquare className="w-5 h-5 text-emerald-600" /> Atividade
          </button>
        </div>
      )}
      <MiniCalendar selected={cursor} onPick={(d) => { setCursor(d); setPanelOpen(false); }} />
      <div>
        <SectionHeader
          id="minhas"
          title="Minhas agendas"
          info={
            <>
              <p><strong>Agendas que você criou.</strong> A primeira, com o seu nome, é a sua agenda <strong>pessoal</strong>: só você vê, nem o Admin, a não ser que você compartilhe.</p>
              <p>Use o <strong>+</strong> para criar uma agenda (ex.: TI, Reuniões) e a engrenagem para mudar nome e cor ou compartilhar com pessoas (Ver, Editar ou Gerenciar).</p>
              <p>A caixinha liga e desliga a agenda na tela, sem apagar nada.</p>
            </>
          }
          action={agendaEdit && (
            <button type="button" onClick={() => setSettings({ calendar: null })} className="p-1 ml-1 rounded-full text-slate-500 hover:bg-slate-100" title="Criar agenda" aria-label="Criar agenda"><Plus className="w-4 h-4" /></button>
          )}
        />
        {collapsed.has('minhas') ? null : calendars === null ? <p className="text-xs text-slate-400 px-1">Carregando…</p> : (
          <ul className="space-y-0.5">
            {mineCals.map((c) => <LayerRow key={c.id} layer={calLayer(c.id)} label={c.name} color={c.color} sub={calSub(c)} onSettings={() => setSettings({ calendar: c })} />)}
            {mineCals.length === 0 && <li className="text-xs text-slate-400 px-1">Nenhuma.</li>}
          </ul>
        )}
      </div>
      {(otherCals.length > 0 || hasInvites) && (
        <div>
          <SectionHeader
            id="outras"
            title="Outras agendas"
            info={
              <>
                <p><strong>Agendas de outras pessoas que você acompanha:</strong> as que compartilharam com você e as <strong>abertas para todos</strong>, como a Geral.</p>
                <p>O que você pode fazer depende do acesso que recebeu: <strong>Ver</strong>, <strong>Editar eventos</strong> ou <strong>Gerenciar</strong>. A engrenagem mostra seu acesso e tem a opção de sair da agenda.</p>
                <p><strong>Convites e atribuições</strong> são eventos para os quais você foi convidado e atividades em que você é o responsável, de agendas que você não acompanha.</p>
              </>
            }
          />
          {!collapsed.has('outras') && <ul className="space-y-0.5">
            {otherCals.map((c) => <LayerRow key={c.id} layer={calLayer(c.id)} label={c.name} color={c.color} sub={calSub(c)} onSettings={() => setSettings({ calendar: c })} />)}
            {hasInvites && <LayerRow layer={INVITES_LAYER} label="Convites e atribuições" color="cinza" sub="De agendas que você não acompanha" />}
          </ul>}
        </div>
      )}
      {systemLayers.length > 0 && (
        <div>
          <SectionHeader
            id="erp"
            title="Datas do ERP"
            info={<p>Datas que vêm dos outros módulos, sem precisar cadastrar: vencimentos (domínios, licenças, contratos, garantias), aniversários, tempo de casa, feriados, férias e folgas e manutenções. Você só vê as dos módulos liberados para você. Para mudar, edite no módulo de origem.</p>}
          />
          {!collapsed.has('erp') && <ul className="space-y-0.5">
            {systemLayers.map((l) => <LayerRow key={l.key} layer={l.key} label={l.label} color={l.color} />)}
          </ul>}
        </div>
      )}
      <div>
        <SectionHeader
          id="cores"
          title="Etiquetas de cor"
          info={<p>Seus nomes para as cores dos eventos e atividades (ex.: <strong>ADM</strong> = verde, <strong>Fin</strong> = azul). São <strong>só seus</strong>: outras pessoas não veem e criam as delas. Desmarque uma etiqueta para esconder os eventos daquela cor. "Outras cores" são as cores sem nome.</p>}
          action={
            <button type="button" onClick={() => { setLabelEdit(undefined); setLabelsOpen(true); }} className="p-1 ml-1 rounded-full text-slate-500 hover:bg-slate-100" title="Criar e editar suas etiquetas" aria-label="Etiquetas de cor">
              <Pencil className="w-4 h-4" />
            </button>
          }
        />
        {!collapsed.has('cores') && (
          <ul className="space-y-0.5">
            {labels.map((l) => <LayerRow key={l.color} layer={`cor:${l.color}`} label={l.name} color={l.color} settingsIcon="edit" onSettings={() => { setLabelEdit(l.color); setLabelsOpen(true); }} />)}
            {labels.length > 0 && <LayerRow layer="cor:outras" label="Outras cores" color="cinza" sub="Sem etiqueta" />}
            {labels.length === 0 && (
              <li className="text-xs text-slate-400 px-1">
                <button type="button" onClick={() => setLabelsOpen(true)} className="text-blue-600 hover:underline">Dê nome às cores</button> (ex.: ADM = verde) para filtrar a agenda.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );

  const ev = detail?.event;
  const evId = ev?.id;
  const evExternal = externalEmails(ev?.guests);
  const myGuest = ev?.agenda_event_guests?.find((g) => g.user_id === meId);
  const detailCal = ev ? calById.get(ev.calendar_id) : undefined;
  const formCal = form ? calById.get(form.calendar_id) : undefined;
  const isTask = form?.kind === 'atividade';

  return (
    <TaskToggleContext.Provider value={toggleTask}>
    <div className="flex gap-6">
      {dialog}
      <aside className="hidden lg:block w-60 shrink-0 pt-1">{panel}</aside>

      {panelOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setPanelOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-slate-800 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-blue-600" /> Agenda</span>
              <button type="button" onClick={() => setPanelOpen(false)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            {panel}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPanelOpen(true)} className="lg:hidden p-2 rounded-full hover:bg-slate-200/60 text-slate-600" aria-label="Agendas e minicalendário"><PanelLeft className="w-5 h-5" /></button>
          {view !== 'atividades' && (
            <>
              <button type="button" onClick={() => setCursor(todayKey())} className="px-4 py-1.5 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Hoje</button>
              <div className="flex">
                <button type="button" onClick={() => move(-1)} className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-600 text-xl leading-none w-8 h-8" aria-label="Anterior">‹</button>
                <button type="button" onClick={() => move(1)} className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-600 text-xl leading-none w-8 h-8" aria-label="Próximo">›</button>
              </div>
            </>
          )}
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800 first-letter:uppercase flex-1 min-w-0 truncate">{titleOf(view, cursor)}</h2>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPrefsOpen((v) => !v)}
              className={`p-2 rounded-full hover:bg-slate-200/60 text-slate-600 ${prefsOpen ? 'bg-slate-200/60' : ''}`}
              title="Configurações"
              aria-label="Configurações"
              aria-expanded={prefsOpen}
            >
              <Settings2 className="w-5 h-5" />
            </button>
            {prefsOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPrefsOpen(false)} aria-hidden="true" />
                <div role="menu" className="absolute right-0 top-full mt-1 z-40 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-2">
                  <p className="px-2 pt-1 pb-2 text-xs font-semibold uppercase text-slate-400">Configurações</p>
                  <label className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={weekends} onChange={(e) => setWeekends(e.target.checked)} className="w-4 h-4 mt-0.5 rounded" />
                    <span className="text-sm text-slate-700">
                      Mostrar fins de semana
                      <span className="block text-xs text-slate-500">Desligado: só de segunda a sexta na Semana, no Mês e na Programação.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={emailOn !== false} disabled={emailOn === null} onChange={(e) => toggleEmail(e.target.checked)} className="w-4 h-4 mt-0.5 rounded" />
                    <span className="text-sm text-slate-700">
                      Avisos por e-mail
                      <span className="block text-xs text-slate-500">Receber e-mail quando compartilharem uma agenda, convidarem você ou atribuírem uma atividade. O sino do ERP avisa sempre.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={activitiesOn !== false} disabled={activitiesOn === null} onChange={(e) => toggleActivities(e.target.checked)} className="w-4 h-4 mt-0.5 rounded" />
                    <span className="text-sm text-slate-700">
                      Avisos de atividades
                      <span className="block text-xs text-slate-500">Desligado: você não recebe aviso (sino nem e-mail) quando for colocado como responsável por uma atividade, nem lembretes de atividades. Os eventos continuam avisando.</span>
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>
          <select value={view} onChange={(e) => setView(e.target.value as View)} className="px-3 py-1.5 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700" aria-label="Visão">
            {(Object.keys(VIEW_LABEL) as View[]).map((v) => <option key={v} value={v}>{VIEW_LABEL[v]}</option>)}
          </select>
        </div>

        {notice && (
          <div role="alert" className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-2.5 text-sm flex items-start gap-2">
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="p-0.5 rounded hover:bg-blue-100" aria-label="Fechar aviso"><X className="w-4 h-4" /></button>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-xs space-y-0.5">
            {[...new Set(warnings)].map((w) => <p key={w}>{w}</p>)}
          </div>
        )}

        {view === 'mes' && <MonthView cursor={cursor} itemsOn={itemsOn} onOpen={setDetail} onDay={goDay} onCreate={openCreate && ((d) => openCreate(d))} mobile={mobile} weekends={weekends} />}
        {view === 'semana' && <TimeGrid days={weekDays} itemsOn={itemsOn} onOpen={setDetail} onDay={goDay} onCreate={openCreate && ((d, t) => openCreate(d, t))} />}
        {view === 'dia' && <TimeGrid days={[cursor]} itemsOn={itemsOn} onOpen={setDetail} onDay={goDay} onCreate={openCreate && ((d, t) => openCreate(d, t))} />}
        {view === 'lista' && <ListView from={cursor} itemsOn={itemsOn} onOpen={setDetail} onDay={goDay} weekends={weekends} />}
        {view === 'atividades' && (
          <ActivitiesBoard
            items={activities && activities.filter((i) => !hidden.has(i.layer) && !colorHidden(i))} meId={meId} users={userById} calendars={calById} canChange={canChangeStatus}
            onStatus={setStatus} onOpen={setDetail} onCreate={openCreate && (() => openCreate(todayKey(), undefined, 'atividade'))}
          />
        )}
      </div>

      {canCreate && !form && !detail && !settings && (
        <button type="button" onClick={() => openCreate?.(view === 'atividades' ? todayKey() : cursor, undefined, view === 'atividades' ? 'atividade' : 'evento')} className="lg:hidden fixed right-4 bottom-5 z-30 w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-xl flex items-center justify-center" aria-label="Criar">
          <Plus className="w-7 h-7 text-blue-600" />
        </button>
      )}

      {/* Detalhes */}
      {detail && (
        <Sheet onClose={() => setDetail(null)} label="Detalhes">
          <div className="flex justify-end gap-1 px-3 pt-3">
            {ev && canEditEvent(ev) && (
              <button type="button" onClick={() => { setFormError(null); setForm(formFromEvent(ev)); setDetail(null); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" title="Editar" aria-label="Editar"><Pencil className="w-5 h-5" /></button>
            )}
            {ev && canEditEvent(ev) && (
              <button type="button" onClick={() => remove(ev)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" title="Excluir" aria-label="Excluir"><Trash2 className="w-5 h-5" /></button>
            )}
            <button type="button" onClick={() => setDetail(null)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" aria-label="Fechar"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-5 sm:px-6 pb-6 space-y-3">
            <div className="flex gap-4">
              <span className="w-4 h-4 rounded mt-1.5 shrink-0" style={{ backgroundColor: colorHex(detail.color) }} />
              <div className="min-w-0">
                <h3 className={`text-xl font-semibold break-words flex items-center gap-2 ${ev?.status === 'finalizado' ? 'line-through text-slate-400' : 'text-slate-800'}`}><TaskMark item={detail} size="lg" className="text-slate-500" />{detail.title}</h3>
                <p className="text-sm text-slate-600 first-letter:uppercase">{ev?.kind === 'atividade' ? `Prazo: ${whenText(detail)}${itemDuration(detail) ? ` (duração prevista: ${fmtDuration(itemDuration(detail)!)})` : ''}` : whenText(detail)}</p>
                {ev && ev.recurrence !== 'nenhuma' && (
                  <p className="text-sm text-slate-600">{RECURRENCE_LABEL[ev.recurrence]}{ev.recurrence_until ? `, até ${fmtDate(ev.recurrence_until, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
                )}
              </div>
            </div>

            {ev && (
              <div className="ml-8 space-y-2">
                {isRecurringTask(ev) && (
                  <p className="text-xs text-slate-500">Situação de <strong>{fmtDate(detail.date, { weekday: 'long', day: '2-digit', month: '2-digit' })}</strong>. Cada repetição tem a sua.</p>
                )}
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Situação">
                  {TASK_STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={(ev.status || 'nao_iniciado') === s}
                      disabled={!canChangeStatus(ev)}
                      onClick={() => (ev.status || 'nao_iniciado') !== s && setStatus(ev, s, detail.date)}
                      className={`px-3 py-1.5 rounded-full border text-sm font-semibold disabled:cursor-default ${(ev.status || 'nao_iniciado') === s ? STATUS_CLS[s] + ' ring-1 ring-current' : 'border-slate-200 text-slate-500 hover:bg-slate-50 disabled:hover:bg-transparent'}`}
                    >
                      {TASK_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                {ev.kind === 'atividade' && <p className="text-sm text-slate-700 flex gap-2"><User className="w-4 h-4 mt-0.5 text-slate-400" />Responsável: {ev.assignee_id ? userLabel(userById.get(ev.assignee_id)) : 'ninguém'}</p>}
                {ev.completed_at && <p className="text-xs text-slate-500">Finalizado em {new Date(ev.completed_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</p>}
              </div>
            )}

            {ev && reminderLabel(ev.reminder_minutes, !ev.start_time) && (
              <p className="flex gap-4 text-sm text-slate-700"><BellRing className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />Lembrete: {reminderLabel(ev.reminder_minutes, !ev.start_time)}</p>
            )}
            {ev?.meeting_url && (
              <div className="flex gap-4 items-center">
                <Video className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <a href={ev.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
                    <Video className="w-4 h-4" /> {isGoogleMeet(ev.meeting_url) ? 'Entrar com Google Meet' : 'Entrar na videochamada'}
                  </a>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(ev.meeting_url!).then(() => setNotice('Link da videochamada copiado.')).catch(() => undefined)} className="px-3 py-2 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100">Copiar link</button>
                  <span className="basis-full text-xs text-slate-500 truncate">{ev.meeting_url.replace(/^https:\/\//, '')}</span>
                </div>
              </div>
            )}
            {ev?.location && <p className="flex gap-4 text-sm text-slate-700"><MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" /><span className="break-words">{ev.location}</span></p>}
            {ev?.responsible_employee_id && <p className="flex gap-4 text-sm text-slate-700"><User className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />Responsável: {employees?.find((e) => e.id === ev.responsible_employee_id)?.full_name || '…'}</p>}
            {ev && (ev.agenda_event_guests?.length || ev.guests) ? (
              <div className="flex gap-4 text-sm text-slate-700">
                <Users className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <div className="min-w-0 space-y-1">
                  {!!ev.agenda_event_guests?.length && (
                    <>
                      <p className="text-xs text-slate-500">
                        {ev.agenda_event_guests.length} convidado(s) · {ev.agenda_event_guests.filter((g) => g.response === 'sim').length} sim · {ev.agenda_event_guests.filter((g) => g.response === 'pendente').length} aguardando
                      </p>
                      <ul className="space-y-0.5">
                        {ev.agenda_event_guests.map((g) => (
                          <li key={g.user_id} className="flex items-center gap-2">
                            <span className="truncate">{userLabel(userById.get(g.user_id))}</span>
                            <span className={`text-[11px] px-1.5 rounded border ${g.response === 'sim' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : g.response === 'nao' ? 'bg-rose-50 border-rose-200 text-rose-700' : g.response === 'talvez' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{RESPONSE_LABEL[g.response]}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {evExternal.length > 0 ? (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-slate-500">De fora do ERP (convite por e-mail):</p>
                      <ul className="space-y-0.5">
                        {evExternal.map((m) => {
                          const sent = externalSent.find((x) => x.email === m);
                          return (
                            <li key={m} className="flex flex-wrap items-center gap-2">
                              <span className="break-all">{m}</span>
                              <span className={`text-[11px] px-1.5 rounded border ${sent ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                {sent ? `Convite enviado ${new Date(sent.sent_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : 'Não enviado'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {canEditEvent(ev) && evId && (
                        <button type="button" onClick={() => sendInvites(evId, externalSent.length > 0)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                          {externalSent.length ? 'Reenviar convite (ex.: mudou o horário)' : 'Enviar convite agora'}
                        </button>
                      )}
                    </div>
                  ) : ev.guests ? <p className="break-words text-slate-600">{ev.guests}</p> : null}
                </div>
              </div>
            ) : null}
            {ev?.description && <p className="flex gap-4 text-sm text-slate-700 whitespace-pre-wrap"><AlignLeft className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" /><span className="break-words min-w-0">{ev.description}</span></p>}
            {!ev && detail.subtitle && <p className="flex gap-4 text-sm text-slate-700"><AlignLeft className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />{detail.subtitle}</p>}
            <p className="flex gap-4 text-sm text-slate-500">
              <CalendarDays className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
              {ev ? detailCal?.name || 'Agenda de outra pessoa' : SYSTEM_LAYERS.find((l) => l.key === detail.layer)?.label}
              {ev && labelOf(detail.color) && (
                <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full border border-slate-200 text-xs text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorHex(detail.color) }} /> {labelOf(detail.color)!.name}
                </span>
              )}
            </p>
            {detail.link && (
              <Link to={detail.link} className="inline-flex items-center gap-1.5 ml-8 text-sm font-semibold text-blue-600 hover:text-blue-800">
                Abrir no módulo <ExternalLink className="w-4 h-4" />
              </Link>
            )}
            {ev && myGuest && (
              <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600 mr-1">Vai participar?</span>
                {(['sim', 'nao', 'talvez'] as const).map((r) => (
                  <button key={r} type="button" onClick={() => respond(ev, r)} className={`px-4 py-1.5 rounded-full border text-sm font-semibold ${myGuest.response === r ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                    {RESPONSE_LABEL[r]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Sheet>
      )}

      {/* Criar / editar */}
      {form && (
        <Sheet onClose={() => setForm(null)} wide label={form.id ? 'Editar' : 'Criar'}>
          <form onSubmit={save} className="p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-2">
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={200}
                placeholder="Adicionar título"
                className="flex-1 min-w-0 text-xl sm:text-2xl text-slate-800 border-0 border-b-2 border-slate-200 focus:border-blue-600 focus:outline-hidden px-1 py-1.5"
              />
              <button type="button" onClick={() => setForm(null)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>

            {!form.id && (
              <div className="flex gap-1.5 ml-8">
                {(['evento', 'atividade'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setForm({ ...form, kind: k, assignee_id: k === 'atividade' && !form.assignee_id ? meId || '' : form.assignee_id })} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${form.kind === k ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {k === 'evento' ? 'Evento' : 'Atividade'}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Clock className="w-5 h-5 text-slate-400 mt-7 shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="grid grid-cols-2 gap-2">
                  <label className={`${fieldLabelCls} ${isTask ? 'col-span-2' : ''}`}>{isTask ? 'Data' : 'Data de início'}
                    <input type="date" required value={form.start_date} onChange={(e) => {
                      const start = e.target.value;
                      const span = diffDays(form.start_date, form.end_date);
                      setForm({ ...form, start_date: start, end_date: start ? addDays(start, Math.max(0, span)) : form.end_date });
                    }} className={`${inputCls} mt-1`} />
                  </label>
                  {!isTask && (
                    <label className={fieldLabelCls}>Data de término
                      <input type="date" required min={form.start_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={`${inputCls} mt-1`} />
                    </label>
                  )}
                  {!form.allDay && (
                    <>
                      <label className={fieldLabelCls}>Hora de início
                        <input type="time" required value={form.start_time} onChange={(e) => {
                          const start = e.target.value;
                          const dur = timeToMin(form.end_time) - timeToMin(form.start_time);
                          const end = form.start_date === form.end_date && start ? minToTime(Math.min(timeToMin(start) + Math.max(dur, 30), 23 * 60 + 59)) : form.end_time;
                          setForm({ ...form, start_time: start, end_time: end });
                        }} className={`${inputCls} mt-1`} />
                      </label>
                      <label className={fieldLabelCls}>Hora de término
                        <input type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className={`${inputCls} mt-1`} />
                      </label>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={form.allDay} onChange={(e) => {
                      const allDay = e.target.checked;
                      const list = allDay ? REMINDER_OPTIONS_ALLDAY : REMINDER_OPTIONS_TIMED;
                      // Lembrete que não existe no outro tipo vira o mais próximo (dia inteiro: no dia às 8h; com horário: 30 min antes)
                      const reminder = form.reminder === '' || list.some((o) => String(o.value) === form.reminder) ? form.reminder : allDay ? '0' : '30';
                      setForm({ ...form, allDay, reminder });
                    }} className="w-4 h-4 rounded" /> {isTask ? 'Sem horário' : 'Dia inteiro'}
                  </label>
                  {(
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <Repeat className="w-4 h-4 text-slate-400" />
                      <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as Recurrence })} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
                        {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
                      </select>
                    </label>
                  )}
                  {form.recurrence !== 'nenhuma' && (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      até
                      <input type="date" min={form.start_date} value={form.recurrence_until} onChange={(e) => setForm({ ...form, recurrence_until: e.target.value })} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white" aria-label="Repetir até" />
                    </label>
                  )}
                </div>
                {form.id && form.recurrence !== 'nenhuma' && <p className="text-xs text-slate-500">As alterações valem para todas as repetições.</p>}
                {form.recurrence !== 'nenhuma' && <p className="text-xs text-slate-500">Cada repetição tem a própria situação: marque cada dia como Fazendo ou Finalizado {isTask ? 'no calendário ou no quadro de Atividades' : 'no calendário'}.</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <BellRing className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                {isTask && (
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-2 cursor-pointer">
                    <input type="checkbox" checked={form.muted} onChange={(e) => setForm({ ...form, muted: e.target.checked })} className="w-4 h-4 rounded" />
                    Não notificar
                    <span className="text-xs text-slate-500">(sem aviso ao responsável e sem lembrete)</span>
                  </label>
                )}
                {!(isTask && form.muted) && (<>
                <select value={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.value })} className={inputCls} aria-label="Lembrete">
                  <option value="">Sem lembrete</option>
                  {(form.allDay ? REMINDER_OPTIONS_ALLDAY : REMINDER_OPTIONS_TIMED).map((o) => <option key={o.value} value={o.value}>Lembrete: {o.label}</option>)}
                  {form.reminder !== '' && !(form.allDay ? REMINDER_OPTIONS_ALLDAY : REMINDER_OPTIONS_TIMED).some((o) => String(o.value) === form.reminder) && (
                    <option value={form.reminder}>Lembrete: {form.reminder} minutos antes</option>
                  )}
                </select>
                {form.reminder !== '' && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Aviso no sino e por e-mail para {isTask ? 'o responsável e quem criou' : 'você e os convidados do ERP'}. {!isTask && 'Quem é de fora recebe o lembrete no próprio Google Agenda ou Outlook.'}
                  </p>
                )}
                </>)}
              </div>
            </div>

            {form.recurrence === 'nenhuma' && <div className="flex gap-3">
              <CheckSquare className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Situação">
                {TASK_STATUS_ORDER.map((s) => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, status: s })} className={`px-3 py-1.5 rounded-full border text-sm font-semibold ${form.status === s ? STATUS_CLS[s] + ' ring-1 ring-current' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    {TASK_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>}

            {isTask && (
              <>
                <div className="flex gap-3">
                  <User className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
                  <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })} className={inputCls} aria-label="Responsável">
                    <option value="">Sem responsável</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}{u.id === meId ? ' (você)' : ''}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <CalendarDays className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
              <select value={form.calendar_id} onChange={(e) => setForm({ ...form, calendar_id: e.target.value })} className={inputCls} aria-label="Agenda">
                {writable.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_personal && c.owner_id === meId ? ' (pessoal)' : ''}</option>)}
              </select>
            </div>

            {!isTask && (
              <>
                <div className="flex gap-3">
                  <Users className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
                  <GuestPicker users={users} value={form.guestIds} meId={meId} onChange={(ids) => setForm({ ...form, guestIds: ids })} />
                </div>
                <div className="flex gap-3">
                  <span className="w-5 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <input value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} maxLength={500} placeholder="E-mails de convidados de fora do ERP (separe por vírgula)" className={inputCls} aria-label="Convidados de fora do ERP" />
                    {externalEmails(form.guests).length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        Ao salvar, {externalEmails(form.guests).length} pessoa(s) recebe(m) o convite por e-mail, com data, local, link da videochamada e arquivo para adicionar à agenda. Quem já recebeu não recebe de novo.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Video className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={form.meeting_url}
                        onChange={(e) => setForm({ ...form, meeting_url: e.target.value })}
                        maxLength={500}
                        placeholder="Link da videochamada (Google Meet, Zoom, Teams)"
                        className={`${inputCls} flex-1 min-w-[12rem]`}
                        aria-label="Link da videochamada"
                      />
                      <a href="https://meet.google.com/new" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                        <Video className="w-4 h-4 text-emerald-600" /> Criar no Meet
                      </a>
                    </div>
                    <p className="text-[11px] text-slate-500">"Criar no Meet" abre uma sala nova na sua conta Google em outra aba: copie o link de lá e cole aqui.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={200} placeholder="Adicionar local" className={inputCls} />
                </div>
                <div className="flex gap-3">
                  <User className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
                  <select value={form.responsible_employee_id} onChange={(e) => setForm({ ...form, responsible_employee_id: e.target.value })} className={inputCls} aria-label="Funcionário responsável">
                    <option value="">Sem funcionário responsável</option>
                    {(employees || []).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="flex gap-3">
              <AlignLeft className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={2000} placeholder="Adicionar descrição" className={inputCls} />
            </div>
            <div className="flex gap-3">
              <span className="w-5 shrink-0" />
              <ColorPicker value={form.color} onChange={(c) => setForm({ ...form, color: c })} inherit={{ hex: colorHex(formCal?.color) }} suggestions={colorSuggestions} labels={labels} />
            </div>

            {isTask && form.assignee_id && form.assignee_id !== meId && (
              <p className="text-xs text-slate-500 ml-8">O responsável vê a atividade e muda a situação, mesmo sem acesso a esta agenda.</p>
            )}
            {formError && <p className="text-sm text-rose-700">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button type="submit" disabled={saving} className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </form>
        </Sheet>
      )}

      {labelsOpen && (
        <ColorLabelsEditor labels={labels} canEdit initialEdit={labelEdit} onClose={() => { setLabelsOpen(false); setLabelEdit(undefined); }} onChanged={() => { setLabelsReload((n) => n + 1); setReload((n) => n + 1); }} />
      )}

      {settings && (
        <CalendarSettings
          calendar={settings.calendar}
          users={users}
          meId={meId}
          canPublic={agendaAdmin}
          isAdmin={profile?.role === 'admin'}
          colorSuggestions={colorSuggestions}
          labels={labels}
          onClose={() => setSettings(null)}
          onChanged={() => setCalReload((n) => n + 1)}
        />
      )}
    </div>
    </TaskToggleContext.Provider>
  );
};
