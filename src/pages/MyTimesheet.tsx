import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Fingerprint, MapPin, PiggyBank, CalendarDays, Plus, RefreshCw, AlertTriangle, FileClock, Ban } from 'lucide-react';
import {
  KIND_LABEL, REQUEST_STATUS, TimeBank, TimeDay, TimeProfile, TimeRequest, TimesheetService, WEEKDAY_LONG,
  balanceClass, currentMonthKey, fmtMinutes, fmtTime, getPunchLocation, monthRange, punchLabel,
} from '../services/timesheetService';
import { formatDate, todayISO } from '../services/subscriptionService';
import {
  DailyTable, EditButton, Feedback, FeedbackBar, Modal, MonthNav, RequestForm, RequestFormValue, StatCard, emptyRequest, monthTotals,
} from '../components/timesheet/TimesheetParts';

/** Relógio de Brasília que atualiza a cada segundo */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export const MyTimesheet: React.FC = () => {
  const now = useNow();
  const [profile, setProfile] = useState<TimeProfile | null | undefined>(undefined);
  const [month, setMonth] = useState(currentMonthKey());
  const [days, setDays] = useState<TimeDay[]>([]);
  const [today, setToday] = useState<TimeDay | null>(null);
  const [bank, setBank] = useState<TimeBank | null>(null);
  const [requests, setRequests] = useState<TimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [punching, setPunching] = useState(false);
  const [note, setNote] = useState('');
  const [requestForm, setRequestForm] = useState<RequestFormValue | null>(null);
  const [sending, setSending] = useState(false);

  const flash = (f: Feedback) => {
    setFeedback(f);
    if (f?.type === 'success') setTimeout(() => setFeedback(null), 5000);
  };

  const loadMonth = useCallback(async (employeeId: string, m: string) => {
    const { from, to } = monthRange(m);
    setDays(await TimesheetService.daily(employeeId, from, to));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const p = await TimesheetService.myProfile();
      setProfile(p);
      if (!p) return;
      const t = todayISO();
      const [todayRows, b, reqs] = await Promise.all([
        TimesheetService.daily(p.employee_id, t, t),
        TimesheetService.bank(p.employee_id),
        TimesheetService.requests({ employeeId: p.employee_id, limit: 50 }),
      ]);
      setToday(todayRows[0] || null);
      setBank(b);
      setRequests(reqs);
      await loadMonth(p.employee_id, month);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMonth]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const changeMonth = async (m: string) => {
    setMonth(m);
    if (!profile) return;
    try {
      await loadMonth(profile.employee_id, m);
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    }
  };

  const punches = today?.punches || [];
  const nextLabel = punchLabel(punches.length);
  const isEntry = punches.length % 2 === 0;

  // Trabalhado hoje, contando o período em andamento
  const workedToday = useMemo(() => {
    let total = 0;
    for (let i = 0; i < punches.length; i += 2) {
      const start = Date.parse(punches[i]);
      const end = punches[i + 1] ? Date.parse(punches[i + 1]) : now.getTime();
      total += Math.max(0, Math.floor((end - start) / 60000));
    }
    return total;
  }, [punches, now]);

  const punch = async () => {
    if (!profile) return;
    setPunching(true);
    try {
      // Localização só no momento da batida; sem ela o ponto é registrado do mesmo jeito
      const loc = await getPunchLocation();
      const p = await TimesheetService.punch(note, loc);
      setNote('');
      const semLocal = p.location_status === 'negada'
        ? ' Sem localização: você não permitiu o acesso à localização.'
        : p.location_status === 'indisponivel' ? ' Sem localização: o aparelho não conseguiu obtê-la.' : '';
      flash({ type: 'success', text: `${nextLabel} registrada às ${fmtTime(p.punched_at)}.${semLocal}` });
      const t = todayISO();
      const [rows] = await Promise.all([TimesheetService.daily(profile.employee_id, t, t)]);
      setToday(rows[0] || null);
      if (month === currentMonthKey()) await loadMonth(profile.employee_id, month);
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    } finally {
      setPunching(false);
    }
  };

  const sendRequest = async (v: RequestFormValue) => {
    if (!profile) return;
    setSending(true);
    try {
      await TimesheetService.createRequest({ ...v, employee_id: profile.employee_id });
      setRequestForm(null);
      setRequests(await TimesheetService.requests({ employeeId: profile.employee_id, limit: 50 }));
      flash({ type: 'success', text: 'Solicitação enviada ao RH.' });
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    } finally {
      setSending(false);
    }
  };

  const cancelRequest = async (r: TimeRequest) => {
    if (!profile || !window.confirm('Cancelar esta solicitação?')) return;
    try {
      await TimesheetService.cancelRequest(r.id);
      setRequests(await TimesheetService.requests({ employeeId: profile.employee_id, limit: 50 }));
      flash({ type: 'success', text: 'Solicitação cancelada.' });
    } catch (e: any) {
      flash({ type: 'error', text: e.message });
    }
  };

  if (loading && profile === undefined) {
    return <div className="p-8 text-center text-slate-500">Carregando seu ponto...</div>;
  }

  if (loadError && !profile) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-6 text-sm text-rose-700 flex gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0" /> {loadError}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-12 shadow-sm">
        <Fingerprint className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Seu usuário não está ligado a um cadastro de funcionário</h2>
        <p className="text-sm text-slate-600 mt-2">Peça ao RH ou ao administrador para ligar o seu usuário ao seu cadastro de funcionário.</p>
      </div>
    );
  }

  const totals = monthTotals(days);
  const pending = requests.filter((r) => r.status === 'pendente').length;
  const expectedToday = today?.expected_minutes ?? 0;
  const timeStr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  const dateStr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' }).format(now);
  const blocked = profile.status === 'desligado';

  return (
    <div className="space-y-4 md:space-y-6">
      <FeedbackBar feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Relógio e registro */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm text-slate-500">Olá, <strong className="text-slate-700">{profile.full_name}</strong></p>
            <div className="text-4xl sm:text-5xl font-bold text-slate-800 tabular-nums tracking-tight mt-1">{timeStr}</div>
            <p className="text-sm text-slate-500 capitalize mt-1">{dateStr} · horário de Brasília</p>
            {today?.holiday && <p className="text-xs text-violet-700 mt-2">Feriado: {today.holiday}</p>}
            {today?.absence && <p className="text-xs text-sky-700 mt-2">{KIND_LABEL[today.absence]} aprovado(a) para hoje</p>}
          </div>
          <div className="w-full sm:w-56 space-y-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Observação (opcional)"
              className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              onClick={punch}
              disabled={punching || blocked}
              className={`w-full py-5 sm:py-4 text-lg sm:text-base rounded-xl text-white font-bold shadow-md flex flex-col items-center gap-1 disabled:opacity-50 transition-colors ${
                isEntry ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Fingerprint className="w-7 h-7" />
              <span>{punching ? 'Pegando localização e registrando...' : `Registrar ${nextLabel.toLowerCase()}`}</span>
            </button>
            <p className="text-[11px] text-slate-500 flex items-start gap-1 leading-snug">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-px" />
              A localização é registrada só no momento da batida, para o controle de ponto. Se não permitir, o ponto é registrado sem ela.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Clock className="w-4 h-4" /> Hoje</h3>
            <span className="text-xs text-slate-500 tabular-nums">
              {fmtMinutes(workedToday)} de {fmtMinutes(expectedToday)}
            </span>
          </div>
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${expectedToday ? Math.min(100, (workedToday / expectedToday) * 100) : workedToday ? 100 : 0}%` }}
            />
          </div>
          <ul className="mt-4 space-y-1.5">
            {punches.length === 0 && <li className="text-sm text-slate-500">Nenhuma marcação hoje.</li>}
            {punches.map((p, i) => (
              <li key={p} className="flex justify-between text-sm">
                <span className="text-slate-600">{punchLabel(i)}</span>
                <span className="font-mono font-semibold text-slate-800 tabular-nums">{fmtTime(p)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={PiggyBank}
          label="Banco de horas"
          value={fmtMinutes(bank?.total_minutes ?? 0, true)}
          valueClass={balanceClass(bank?.total_minutes)}
          hint={bank ? `Desde ${formatDate(bank.start_date)}, até ontem` : undefined}
        />
        <StatCard icon={CalendarDays} label="Saldo do mês" value={fmtMinutes(totals.balance, true)} valueClass={balanceClass(totals.balance)} hint={`${fmtMinutes(totals.worked)} de ${fmtMinutes(totals.expected)}`} />
        <StatCard icon={AlertTriangle} label="Faltas / incompletos" value={`${totals.absences} / ${totals.incomplete}`} hint="No mês selecionado" valueClass={totals.absences + totals.incomplete ? 'text-amber-600' : 'text-slate-800'} />
        <StatCard icon={FileClock} label="Solicitações pendentes" value={pending} hint="Aguardando o RH" />
      </div>

      {/* Espelho */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-800">Espelho de ponto</h3>
          <div className="flex flex-wrap gap-2">
            <MonthNav month={month} onChange={changeMonth} />
            <button onClick={loadAll} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold bg-white">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>
        <DailyTable
          days={days}
          rowAction={(d) =>
            d.status === 'incompleto' || d.status === 'falta' ? (
              <EditButton label="Pedir ajuste" onClick={() => setRequestForm(emptyRequest('ajuste', d.work_date))} />
            ) : null
          }
        />
        <p className="text-xs text-slate-500">
          Jornada: {profile.weekday_minutes.map((m, i) => (m ? `${WEEKDAY_LONG[i].slice(0, 3)} ${fmtMinutes(m)}` : null)).filter(Boolean).join(' · ')}.
          Diferenças de até {profile.tolerance_minutes} min no dia não contam.
        </p>
      </div>

      {/* Solicitações */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-slate-800">Minhas solicitações</h3>
          <button
            onClick={() => setRequestForm(emptyRequest('ferias'))}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova solicitação
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {requests.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">Nenhuma solicitação ainda. Use o botão acima para pedir férias, folga ou ajuste de marcação.</p>}
          {requests.map((r) => (
            <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-800">{KIND_LABEL[r.kind]}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${REQUEST_STATUS[r.status].cls}`}>{REQUEST_STATUS[r.status].label}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {r.kind === 'ajuste'
                    ? `${formatDate(r.start_date)} às ${r.punch_time?.slice(0, 5)}`
                    : r.start_date === r.end_date ? formatDate(r.start_date) : `${formatDate(r.start_date)} a ${formatDate(r.end_date)}`}
                  {' · '}{r.reason}
                </p>
                {r.review_note && <p className="text-xs text-slate-600 mt-0.5">Resposta do RH: {r.review_note}</p>}
              </div>
              {r.status === 'pendente' && (
                <button onClick={() => cancelRequest(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600 shrink-0">
                  <Ban className="w-3.5 h-3.5" /> Cancelar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {requestForm && (
        <Modal title="Nova solicitação" onClose={() => setRequestForm(null)}>
          <RequestForm initial={requestForm} busy={sending} submitLabel="Enviar ao RH" onCancel={() => setRequestForm(null)} onSubmit={sendRequest} />
        </Modal>
      )}
    </div>
  );
};
