import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays, addMonths, AgendaItem, colorHex, diffDays, fillStyle, fmtDate, fmtTime, minToTime, nowMinutes, startOfMonth, startOfWeek,
  TASK_STATUS_LABEL, timeToMin, todayKey, weekday,
} from '../../services/agendaService';

// Visões da agenda (no estilo do Google Agenda): minicalendário, mês, dia/semana e programação.

export type View = 'dia' | 'semana' | 'mes' | 'lista' | 'atividades';

export const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const HOUR_PX = 48;
export const LIST_DAYS = 60;

export function rangeOf(view: View, cursor: string): { from: string; to: string } {
  if (view === 'dia') return { from: cursor, to: cursor };
  if (view === 'semana') {
    const s = startOfWeek(cursor);
    return { from: s, to: addDays(s, 6) };
  }
  if (view === 'mes') {
    const s = startOfWeek(startOfMonth(cursor));
    return { from: s, to: addDays(s, 41) };
  }
  // Programação e atividades: a partir do dia escolhido
  return { from: cursor, to: addDays(cursor, LIST_DAYS - 1) };
}

export function titleOf(view: View, cursor: string): string {
  if (view === 'dia') return fmtDate(cursor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (view === 'mes') return fmtDate(cursor, { month: 'long', year: 'numeric' });
  if (view === 'lista') return `A partir de ${fmtDate(cursor, { day: 'numeric', month: 'long' })}`;
  if (view === 'atividades') return 'Atividades';
  const s = startOfWeek(cursor);
  const e = addDays(s, 6);
  if (s.slice(0, 7) === e.slice(0, 7)) return fmtDate(s, { month: 'long', year: 'numeric' });
  if (s.slice(0, 4) === e.slice(0, 4)) return `${fmtDate(s, { month: 'short' })} – ${fmtDate(e, { month: 'short', year: 'numeric' })}`;
  return `${fmtDate(s, { month: 'short', year: 'numeric' })} – ${fmtDate(e, { month: 'short', year: 'numeric' })}`;
}

export const isTimed = (i: AgendaItem) => !!i.startTime;

/** Ordem do dia: dia inteiro (mais longos primeiro), depois por horário */
export const sortItems = (a: AgendaItem, b: AgendaItem) => {
  if (isTimed(a) !== isTimed(b)) return isTimed(a) ? 1 : -1;
  if (!isTimed(a)) return diffDays(b.date, b.endDate) - diffDays(a.date, a.endDate) || a.title.localeCompare(b.title, 'pt-BR');
  return (a.startTime || '').localeCompare(b.startTime || '') || a.title.localeCompare(b.title, 'pt-BR');
};

export function whenText(i: AgendaItem): string {
  const sameDay = i.date === i.endDate;
  const d1 = fmtDate(i.date, { weekday: 'long', day: 'numeric', month: 'long' });
  if (!i.startTime) {
    return sameDay ? `${d1} · Dia inteiro` : `${fmtDate(i.date, { day: 'numeric', month: 'short' })} – ${fmtDate(i.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  if (sameDay) return `${d1} · ${fmtTime(i.startTime)} – ${fmtTime(i.endTime || i.startTime)}`;
  return `${fmtDate(i.date, { day: 'numeric', month: 'short' })}, ${fmtTime(i.startTime)} – ${fmtDate(i.endDate, { day: 'numeric', month: 'short' })}, ${fmtTime(i.endTime || '00:00')}`;
}


/** Quem pode marcar a atividade como finalizada (a página fornece; sem ele a marca só mostra) */
export const TaskToggleContext = React.createContext<((item: AgendaItem) => void) | null>(null);

/**
 * Caixinha da atividade: vazia (não iniciado), meio cheia (fazendo) ou com ✓ (finalizado).
 * Clicar marca como finalizado; clicar de novo volta para não iniciado.
 */
export const TaskMark: React.FC<{ item: AgendaItem; className?: string; size?: 'sm' | 'lg' }> = ({ item, className = '', size = 'sm' }) => {
  const toggle = React.useContext(TaskToggleContext);
  const s = item.event?.status || null;
  if (!s) return null;
  const dim = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  const box = (
    <span className={`${dim} rounded-full border-2 border-current inline-flex items-center justify-center shrink-0 overflow-hidden`}>
      {s === 'finalizado' && (
        <svg viewBox="0 0 12 12" className="w-full h-full" aria-hidden="true">
          <path d="M2.8 6.2l2.1 2.1L9.3 3.9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {s === 'fazendo' && <span className="w-1/2 h-full bg-current self-stretch mr-auto" />}
    </span>
  );
  const label = `${TASK_STATUS_LABEL[s]}${toggle ? (s === 'finalizado' ? ' · clique para reabrir' : ' · clique para finalizar') : ''}`;
  if (!toggle) return <span title={label} aria-label={label} className={`inline-flex ${className}`}>{box}</span>;
  return (
    <span
      role="checkbox"
      aria-checked={s === 'finalizado'}
      aria-label={label}
      title={label}
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggle(item); }}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); toggle(item); } }}
      className={`inline-flex cursor-pointer rounded-full hover:scale-110 transition-transform focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      {box}
    </span>
  );
};

const done = (i: AgendaItem) => i.event?.status === 'finalizado';

// ---------------- Minicalendário ----------------

export const MiniCalendar: React.FC<{ selected: string; onPick: (d: string) => void }> = ({ selected, onPick }) => {
  const [month, setMonth] = useState(startOfMonth(selected));
  useEffect(() => setMonth(startOfMonth(selected)), [selected]);
  const today = todayKey();
  const gridStart = startOfWeek(month);
  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-sm font-semibold text-slate-700 first-letter:uppercase">{fmtDate(month, { month: 'long', year: 'numeric' })}</span>
        <div className="flex">
          <button type="button" onClick={() => setMonth(addMonths(month, -1))} className="p-1 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={() => setMonth(addMonths(month, 1))} className="p-1 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400 uppercase">
        {WEEKDAYS.map((w) => <span key={w} className="py-1">{w[0]}</span>)}
      </div>
      <div className="grid grid-cols-7 text-center text-xs">
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(gridStart, i);
          const out = d.slice(0, 7) !== month.slice(0, 7);
          const isToday = d === today;
          const isSel = d === selected;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              className={`mx-auto w-7 h-7 rounded-full tabular-nums transition-colors ${
                isToday ? 'bg-blue-600 text-white font-bold' : isSel ? 'bg-blue-100 text-blue-800 font-semibold' : out ? 'text-slate-300 hover:bg-slate-100' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---------------- Chip de evento ----------------

export const Chip: React.FC<{ item: AgendaItem; onOpen: (i: AgendaItem) => void; compact?: boolean }> = ({ item, onOpen, compact }) => {
  if (!item.startTime) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(item); }} style={fillStyle(item.color)} className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] sm:text-xs font-medium hover:brightness-95 flex items-center gap-1 ${done(item) ? 'opacity-60 line-through' : ''}`} title={item.title}>
        <TaskMark item={item} />
        <span className="truncate">{item.title}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(item); }} className="w-full text-left truncate rounded px-1 py-0.5 text-[11px] sm:text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-1" title={`${fmtTime(item.startTime)} ${item.title}`}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorHex(item.color) }} />
      {!compact && <span className="text-slate-500 tabular-nums shrink-0">{fmtTime(item.startTime)}</span>}
      <TaskMark item={item} />
      <span className={`truncate font-medium ${done(item) ? 'line-through text-slate-400' : ''}`}>{item.title}</span>
    </button>
  );
};

// ---------------- Visão Mês ----------------

export const MonthView: React.FC<{
  cursor: string; itemsOn: (d: string) => AgendaItem[]; onOpen: (i: AgendaItem) => void;
  onDay: (d: string) => void; onCreate?: (d: string) => void; mobile: boolean;
  /** false = só de segunda a sexta */
  weekends?: boolean;
}> = ({ cursor, itemsOn, onOpen, onDay, onCreate, mobile, weekends = true }) => {
  const gridStart = startOfWeek(startOfMonth(cursor));
  const today = todayKey();
  const max = mobile ? 2 : 3;
  const cols = weekends ? 'grid-cols-7' : 'grid-cols-5';
  const lastCol = weekends ? 6 : 5;
  const month = cursor.slice(0, 7);
  // Semanas da grade (só os dias visíveis); semana sem nenhum dia deste mês não aparece
  // (ex.: agosto/2026 sem fim de semana começaria com uma linha inteira de julho)
  const cells = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i))
    .filter((d) => weekends || (weekday(d) > 0 && weekday(d) < 6)))
    .filter((week) => week.some((d) => d.slice(0, 7) === month))
    .flat();
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className={`grid ${cols} border-b border-slate-200`}>
        {WEEKDAYS.filter((_, i) => weekends || (i > 0 && i < 6)).map((w) => <div key={w} className="py-2 text-center text-[11px] font-semibold uppercase text-slate-500">{w}</div>)}
      </div>
      <div className={`grid ${cols}`}>
        {cells.map((d) => {
          const i = weekday(d);
          const out = d.slice(0, 7) !== month;
          // Dias de outro mês: só o número, sem eventos (aparecem no mês deles)
          const list = out ? [] : itemsOn(d);
          const extra = list.length - max;
          return (
            <div
              key={d}
              onClick={() => onCreate?.(d)}
              className={`min-h-[4.75rem] sm:min-h-[6.5rem] border-b border-r border-slate-100 p-0.5 sm:p-1 flex flex-col gap-0.5 ${i === lastCol ? 'border-r-0' : ''} ${out ? 'bg-slate-50/60' : ''} ${onCreate ? 'cursor-pointer' : ''}`}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDay(d); }}
                className={`mx-auto w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs tabular-nums ${d === today ? 'bg-blue-600 text-white font-bold' : out ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {Number(d.slice(8)) === 1 && !mobile ? fmtDate(d, { day: 'numeric', month: 'short' }).replace('.', '') : Number(d.slice(8))}
              </button>
              {list.slice(0, max).map((it) => <Chip key={it.key} item={it} onOpen={onOpen} compact={mobile} />)}
              {extra > 0 && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onDay(d); }} className="text-left px-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
                  +{extra} {mobile ? '' : 'mais'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------- Visões Dia e Semana (grade de horários) ----------------

interface Placed { item: AgendaItem; top: number; height: number; col: number; cols: number; startMin: number; endMin: number }

/** Distribui eventos que se sobrepõem lado a lado */
function layoutDay(day: string, items: AgendaItem[]): Placed[] {
  const segs = items
    .filter(isTimed)
    .map((item) => {
      const startMin = item.date === day ? timeToMin(item.startTime!) : 0;
      const endMin = item.endDate === day ? timeToMin(item.endTime || item.startTime!) : 24 * 60;
      return { item, startMin, endMin: Math.max(endMin, startMin + 20) };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const out: Placed[] = [];
  let cluster: typeof out = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => { p.cols = cols; });
    out.push(...cluster);
    cluster = [];
  };
  for (const s of segs) {
    if (s.startMin >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((p) => p.endMin > s.startMin).map((p) => p.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...s, col, cols: 1, top: (s.startMin / 60) * HOUR_PX, height: ((s.endMin - s.startMin) / 60) * HOUR_PX });
    clusterEnd = Math.max(clusterEnd, s.endMin);
  }
  if (cluster.length) flush();
  return out;
}

export const TimeGrid: React.FC<{
  days: string[]; itemsOn: (d: string) => AgendaItem[]; onOpen: (i: AgendaItem) => void;
  onDay: (d: string) => void; onCreate?: (d: string, time?: string) => void;
}> = ({ days, itemsOn, onOpen, onDay, onCreate }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = todayKey();
  const [now, setNow] = useState(nowMinutes());
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 60000);
    return () => clearInterval(t);
  }, []);
  useLayoutEffect(() => {
    // Abre perto do horário atual (ou às 7h)
    const target = days.includes(today) ? Math.max(0, now / 60 - 2) : 7;
    if (scrollRef.current) scrollRef.current.scrollTop = target * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join()]);

  const allDay = days.map((d) => itemsOn(d).filter((i) => !isTimed(i)));
  const wide = days.length > 1;

  const clickSlot = (d: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCreate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30;
    onCreate(d, minToTime(Math.min(Math.max(min, 0), 23 * 60)));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className={wide ? 'overflow-x-auto' : ''}>
        <div className={wide ? 'min-w-[44rem]' : ''}>
          {/* Cabeçalho dos dias */}
          <div className="flex border-b border-slate-200">
            <div className="w-12 sm:w-14 shrink-0" />
            {days.map((d) => (
              <button key={d} type="button" onClick={() => onDay(d)} className="flex-1 py-2 flex flex-col items-center gap-0.5 hover:bg-slate-50 min-w-0">
                <span className={`text-[11px] font-semibold uppercase ${d === today ? 'text-blue-600' : 'text-slate-500'}`}>{WEEKDAYS[weekday(d)]}</span>
                <span className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg sm:text-xl tabular-nums ${d === today ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700'}`}>
                  {Number(d.slice(8))}
                </span>
              </button>
            ))}
          </div>
          {/* Dia inteiro */}
          {allDay.some((l) => l.length) && (
            <div className="flex border-b border-slate-200">
              <div className="w-12 sm:w-14 shrink-0 text-[10px] text-slate-400 text-right pr-2 pt-1">dia todo</div>
              {days.map((d, i) => (
                <div key={d} className="flex-1 min-w-0 p-0.5 space-y-0.5 border-l border-slate-100">
                  {allDay[i].slice(0, 4).map((it) => <Chip key={it.key} item={it} onOpen={onOpen} />)}
                  {allDay[i].length > 4 && <button type="button" onClick={() => onDay(d)} className="px-1 text-[11px] font-semibold text-slate-500">+{allDay[i].length - 4} mais</button>}
                </div>
              ))}
            </div>
          )}
          {/* Horários */}
          <div ref={scrollRef} className="overflow-y-auto h-[60vh] md:h-[calc(100vh-17rem)] min-h-[22rem]">
            <div className="flex relative" style={{ height: 24 * HOUR_PX }}>
              <div className="w-12 sm:w-14 shrink-0 relative">
                {Array.from({ length: 23 }, (_, h) => (
                  <span key={h} className="absolute right-2 text-[10px] text-slate-400 -translate-y-1/2 tabular-nums" style={{ top: (h + 1) * HOUR_PX }}>
                    {h + 1}h
                  </span>
                ))}
              </div>
              {days.map((d) => (
                <div key={d} onClick={(e) => clickSlot(d, e)} className={`flex-1 relative border-l border-slate-100 min-w-0 ${onCreate ? 'cursor-pointer' : ''}`}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: h * HOUR_PX }} />
                  ))}
                  {layoutDay(d, itemsOn(d)).map((p) => {
                    const short = p.height < 36;
                    return (
                      <button
                        key={p.item.key}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpen(p.item); }}
                        className="absolute rounded-md px-1.5 text-left overflow-hidden text-[11px] sm:text-xs leading-tight border border-white shadow-xs hover:brightness-95"
                        style={{ ...fillStyle(p.item.color), top: p.top + 1, height: p.height - 2, left: `calc(${(p.col / p.cols) * 100}% + 2px)`, width: `calc(${100 / p.cols}% - 4px)` }}
                        title={p.item.title}
                      >
                        <span className={`font-semibold ${short ? 'truncate inline' : 'block truncate pt-0.5'} ${done(p.item) ? 'line-through opacity-70' : ''}`}><TaskMark item={p.item} className="mr-1" />{p.item.title}</span>
                        <span className={`opacity-90 tabular-nums ${short ? 'ml-1' : 'block'}`}>{fmtTime(minToTime(p.startMin))} – {fmtTime(minToTime(Math.min(p.endMin, 24 * 60 - 1)))}</span>
                      </button>
                    );
                  })}
                  {d === today && (
                    <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: (now / 60) * HOUR_PX }}>
                      <div className="h-0.5 bg-rose-500 relative"><span className="absolute -left-1.5 -top-[5px] w-3 h-3 rounded-full bg-rose-500" /></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------- Visão Programação (lista) ----------------

export const ListView: React.FC<{
  from: string; itemsOn: (d: string) => AgendaItem[]; onOpen: (i: AgendaItem) => void; onDay: (d: string) => void; weekends?: boolean;
}> = ({ from, itemsOn, onOpen, onDay, weekends = true }) => {
  const today = todayKey();
  const days = Array.from({ length: LIST_DAYS }, (_, i) => addDays(from, i))
    .filter((d) => weekends || (weekday(d) > 0 && weekday(d) < 6))
    .map((d) => ({ d, list: itemsOn(d) }))
    .filter((x) => x.list.length);
  if (!days.length) {
    return <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 text-center text-sm text-slate-500">Nada agendado nos próximos {LIST_DAYS} dias.</div>;
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100">
      {days.map(({ d, list }) => (
        <div key={d} className="flex gap-3 px-3 sm:px-4 py-3">
          <button type="button" onClick={() => onDay(d)} className="w-12 sm:w-24 shrink-0 flex flex-col sm:flex-row items-center sm:items-start gap-0 sm:gap-2 text-left">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center text-lg tabular-nums ${d === today ? 'bg-blue-600 text-white font-semibold' : 'text-slate-800'}`}>{Number(d.slice(8))}</span>
            <span className={`text-[11px] uppercase font-semibold sm:pt-2.5 ${d === today ? 'text-blue-600' : 'text-slate-500'}`}>
              {fmtDate(d, { month: 'short' }).replace('.', '')}, {WEEKDAYS[weekday(d)]}
            </span>
          </button>
          <ul className="flex-1 min-w-0 space-y-1">
            {list.map((it) => {
              return (
                <li key={it.key}>
                  <button type="button" onClick={() => onOpen(it)} className="w-full text-left flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: colorHex(it.color) }} />
                    <span className="w-24 sm:w-32 shrink-0 text-xs sm:text-sm text-slate-500 tabular-nums pt-0.5">
                      {it.startTime ? `${fmtTime(it.startTime)} – ${fmtTime(it.endTime || it.startTime)}` : 'Dia inteiro'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`flex items-center gap-1.5 text-sm font-medium break-words ${done(it) ? 'line-through text-slate-400' : 'text-slate-800'}`}><TaskMark item={it} className="text-slate-500" />{it.title}</span>
                      {it.subtitle && <span className="block text-xs text-slate-500 truncate">{it.subtitle}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

