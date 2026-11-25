import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Pencil } from 'lucide-react';
import {
  DAY_STATUS, KIND_HELP, KIND_LABEL, TimeDay, TimeRequestKind, WEEKDAY_SHORT,
  balanceClass, currentMonthKey, fmtMinutes, fmtTime, monthLabel, punchLabel, shiftMonth,
} from '../../services/timesheetService';
import { formatDate, todayISO } from '../../services/subscriptionService';

export type Feedback = { type: 'success' | 'error'; text: string } | null;

export const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white';
export const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-1';

export const Modal: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  // No celular a janela sobe de baixo e ocupa a largura toda
  <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center sm:p-4">
    <div className={`bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl w-full p-4 sm:p-6 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto space-y-4 ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
      <div className="flex items-start justify-between gap-3 border-b pb-3 border-slate-100">
        <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 min-w-0">{title}</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 -m-1 shrink-0" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const FeedbackBar: React.FC<{ feedback: Feedback; onClose: () => void }> = ({ feedback, onClose }) =>
  feedback ? (
    <div
      className={`flex items-start justify-between gap-3 p-3 rounded-xl border text-sm ${
        feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
      }`}
    >
      <span>{feedback.text}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Fechar aviso">
        <X className="w-4 h-4" />
      </button>
    </div>
  ) : null;

export const MonthNav: React.FC<{ month: string; onChange: (m: string) => void }> = ({ month, onChange }) => (
  <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg">
    <button onClick={() => onChange(shiftMonth(month, -1))} className="p-2 hover:bg-slate-50 rounded-l-lg" aria-label="Mês anterior">
      <ChevronLeft className="w-4 h-4 text-slate-600" />
    </button>
    <span className="text-sm font-semibold text-slate-700 min-w-28 sm:min-w-36 text-center">{monthLabel(month)}</span>
    <button
      onClick={() => onChange(shiftMonth(month, 1))}
      disabled={month >= currentMonthKey()}
      className="p-2 hover:bg-slate-50 rounded-r-lg disabled:opacity-30"
      aria-label="Próximo mês"
    >
      <ChevronRight className="w-4 h-4 text-slate-600" />
    </button>
  </div>
);

export const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; valueClass?: string; icon?: React.ElementType }> = ({
  label, value, hint, valueClass, icon: Icon,
}) => (
  <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
    <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-slate-500 uppercase">
      {Icon && <Icon className="w-4 h-4" />} {label}
    </div>
    <div className={`text-xl sm:text-2xl font-bold mt-1 tabular-nums ${valueClass || 'text-slate-800'}`}>{value}</div>
    {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

/** Totais de um mês (só dias encerrados) */
export function monthTotals(days: TimeDay[]) {
  const closed = days.filter((d) => d.balance_minutes !== null);
  return {
    expected: closed.reduce((s, d) => s + d.expected_minutes, 0),
    worked: closed.reduce((s, d) => s + d.worked_minutes, 0),
    balance: closed.reduce((s, d) => s + (d.balance_minutes || 0), 0),
    absences: closed.filter((d) => d.status === 'falta').length,
    incomplete: closed.filter((d) => d.status === 'incompleto').length,
  };
}

/** Espelho de ponto do mês */
export const DailyTable: React.FC<{
  days: TimeDay[];
  loading?: boolean;
  /** Ação na linha (ex.: pedir ajuste / editar marcações) */
  rowAction?: (day: TimeDay) => React.ReactNode;
}> = ({ days, loading, rowAction }) => {
  const totals = monthTotals(days);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Celular: um cartão por dia */}
      <div className="md:hidden">
        {loading && <p className="px-4 py-8 text-center text-sm text-slate-500">Carregando...</p>}
        {!loading && days.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum dia neste mês dentro do período de controle de ponto.</p>
        )}
        {!loading && days.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {days.map((d) => {
              const st = DAY_STATUS[d.status];
              const weekend = d.weekday === 0 || d.weekday === 6;
              const note = d.holiday || (d.absence ? KIND_LABEL[d.absence] : null);
              const action = rowAction?.(d);
              return (
                <li key={d.work_date} className={`px-4 py-3 ${d.status === 'hoje' ? 'bg-blue-50/40' : weekend ? 'bg-slate-50/60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-slate-700 tabular-nums">{d.work_date.slice(8, 10)}/{d.work_date.slice(5, 7)}</span>
                      <span className="text-slate-400 text-xs">{WEEKDAY_SHORT[d.weekday]}</span>
                      {d.status !== 'futuro' && (
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${st.cls}`}>{st.label}</span>
                      )}
                    </div>
                    <span className={`text-sm tabular-nums font-semibold shrink-0 ${balanceClass(d.balance_minutes)}`}>
                      {d.balance_minutes === null ? '' : d.balance_minutes === 0 ? '0h00' : fmtMinutes(d.balance_minutes, true)}
                    </span>
                  </div>
                  {(d.punches.length > 0 || note) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {d.punches.map((p, i) => (
                        <span
                          key={p}
                          title={punchLabel(i)}
                          className={`px-1.5 py-0.5 rounded text-xs font-mono tabular-nums border ${
                            i % 2 === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {fmtTime(p)}
                        </span>
                      ))}
                      {note && <span className="text-xs text-slate-500 italic">{note}</span>}
                    </div>
                  )}
                  {(d.expected_minutes > 0 || d.worked_minutes > 0 || action) && (
                    <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-slate-500">
                      <span className="tabular-nums">
                        {d.worked_minutes ? fmtMinutes(d.worked_minutes) : '0h00'} de {d.expected_minutes ? fmtMinutes(d.expected_minutes) : '—'}
                      </span>
                      {action}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!loading && days.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 text-sm">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-600">Total do mês</span>
              <span className={`tabular-nums ${balanceClass(totals.balance)}`}>{fmtMinutes(totals.balance, true)}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {fmtMinutes(totals.worked)} de {fmtMinutes(totals.expected)} · {totals.absences} falta(s) · {totals.incomplete} incompleto(s) · dias encerrados
            </p>
          </div>
        )}
      </div>

      {/* Computador: tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Dia</th>
              <th className="text-left px-4 py-2.5 font-semibold">Marcações</th>
              <th className="text-right px-4 py-2.5 font-semibold">Previsto</th>
              <th className="text-right px-4 py-2.5 font-semibold">Trabalhado</th>
              <th className="text-right px-4 py-2.5 font-semibold">Saldo</th>
              <th className="text-left px-4 py-2.5 font-semibold">Situação</th>
              {rowAction && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Carregando...</td>
              </tr>
            )}
            {!loading && days.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nenhum dia neste mês dentro do período de controle de ponto.
                </td>
              </tr>
            )}
            {!loading &&
              days.map((d) => {
                const st = DAY_STATUS[d.status];
                const weekend = d.weekday === 0 || d.weekday === 6;
                const note = d.holiday || (d.absence ? KIND_LABEL[d.absence] : null);
                return (
                  <tr key={d.work_date} className={d.status === 'hoje' ? 'bg-blue-50/40' : weekend ? 'bg-slate-50/60' : ''}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-semibold text-slate-700 tabular-nums">{d.work_date.slice(8, 10)}/{d.work_date.slice(5, 7)}</span>
                      <span className="text-slate-400 ml-1.5 text-xs">{WEEKDAY_SHORT[d.weekday]}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {d.punches.map((p, i) => (
                          <span
                            key={p}
                            title={punchLabel(i)}
                            className={`px-1.5 py-0.5 rounded text-xs font-mono tabular-nums border ${
                              i % 2 === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {fmtTime(p)}
                          </span>
                        ))}
                        {note && <span className="text-xs text-slate-500 italic">{note}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{d.expected_minutes ? fmtMinutes(d.expected_minutes) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">{d.worked_minutes ? fmtMinutes(d.worked_minutes) : '—'}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${balanceClass(d.balance_minutes)}`}>
                      {d.balance_minutes === null ? '—' : d.balance_minutes === 0 ? '0h00' : fmtMinutes(d.balance_minutes, true)}
                    </td>
                    <td className="px-4 py-2">
                      {d.status !== 'futuro' && (
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${st.cls}`}>{st.label}</span>
                      )}
                    </td>
                    {rowAction && <td className="px-4 py-2 text-right whitespace-nowrap">{rowAction(d)}</td>}
                  </tr>
                );
              })}
          </tbody>
          {!loading && days.length > 0 && (
            <tfoot className="bg-slate-50 text-sm font-semibold border-t border-slate-200">
              <tr>
                <td className="px-4 py-2.5 text-slate-600" colSpan={2}>
                  Total do mês <span className="font-normal text-xs text-slate-500">(dias encerrados)</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{fmtMinutes(totals.expected)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmtMinutes(totals.worked)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${balanceClass(totals.balance)}`}>{fmtMinutes(totals.balance, true)}</td>
                <td className="px-4 py-2.5 text-xs font-normal text-slate-500" colSpan={rowAction ? 2 : 1}>
                  {totals.absences} falta(s) · {totals.incomplete} incompleto(s)
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export const EditButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
    <Pencil className="w-3.5 h-3.5" /> {label}
  </button>
);

export interface RequestFormValue {
  kind: TimeRequestKind;
  start_date: string;
  end_date: string;
  punch_time: string;
  reason: string;
}

export const emptyRequest = (kind: TimeRequestKind = 'ajuste', date = todayISO()): RequestFormValue => ({
  kind, start_date: date, end_date: date, punch_time: '', reason: '',
});

/** Formulário de solicitação (ajuste, férias, folga...) */
export const RequestForm: React.FC<{
  initial: RequestFormValue;
  busy: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: RequestFormValue) => void;
  extra?: React.ReactNode;
}> = ({ initial, busy, submitLabel, onCancel, onSubmit, extra }) => {
  const [v, setV] = useState<RequestFormValue>(initial);
  const isAdjust = v.kind === 'ajuste';
  const today = todayISO();
  const days =
    !isAdjust && v.start_date && v.end_date && v.end_date >= v.start_date
      ? Math.round((Date.parse(v.end_date) - Date.parse(v.start_date)) / 86400000) + 1
      : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-4"
    >
      {extra}
      <div>
        <label className={labelClass}>Tipo</label>
        <select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as TimeRequestKind })} className={inputClass}>
          {(Object.keys(KIND_LABEL) as TimeRequestKind[]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">{KIND_HELP[v.kind]}</p>
      </div>
      {isAdjust ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Dia</label>
            <input type="date" required max={today} value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Horário</label>
            <input type="time" required value={v.punch_time} onChange={(e) => setV({ ...v, punch_time: e.target.value })} className={inputClass} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>De</label>
            <input
              type="date" required value={v.start_date}
              onChange={(e) => setV({ ...v, start_date: e.target.value, end_date: v.end_date < e.target.value ? e.target.value : v.end_date })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Até</label>
            <input type="date" required min={v.start_date} value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} className={inputClass} />
          </div>
          {days !== null && <p className="col-span-2 text-xs text-slate-500 -mt-1">{days} dia(s) corrido(s), de {formatDate(v.start_date)} a {formatDate(v.end_date)}.</p>}
        </div>
      )}
      <div>
        <label className={labelClass}>Motivo</label>
        <textarea
          required rows={3} maxLength={500} value={v.reason}
          onChange={(e) => setV({ ...v, reason: e.target.value })}
          className={inputClass}
          placeholder={isAdjust ? 'Ex.: esqueci de bater a saída' : 'Descreva o motivo'}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
          Cancelar
        </button>
        <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
          {busy ? 'Enviando...' : submitLabel}
        </button>
      </div>
    </form>
  );
};
