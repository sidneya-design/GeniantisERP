import React, { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ReportColumn, ReportSection, todayISO } from '../../lib/reports/tableReport';
import { Field, FilterBar, inputCls, ReportActions, ReportError, ReportLoading, ReportTable, StatCards } from './ReportKit';

interface SendRow {
  id: string;
  created_at: string;
  action: string;
  user_email: string | null;
  details: { origem?: string; email?: string; nome?: string; erro?: string } | null;
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const COLUMNS: ReportColumn<SendRow>[] = [
  { header: 'Data e hora', value: (r) => dateTime(r.created_at), width: 18 },
  { header: 'Aniversariante', value: (r) => r.details?.nome, width: 28 },
  { header: 'E-mail', value: (r) => r.details?.email, width: 32 },
  { header: 'Resultado', value: (r) => (r.action === 'email_sent' ? 'Enviado' : 'Falhou'), width: 11 },
  { header: 'Origem', value: (r) => (r.details?.origem === 'manual' ? `Manual (${r.user_email || '—'})` : 'Automático'), width: 30 },
  { header: 'Erro', value: (r) => r.details?.erro, width: 40 },
];

const PAGE = 1000;

async function loadSends(from: string, to: string): Promise<SendRow[]> {
  if (!isSupabaseConfigured) return [];
  const out: SendRow[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, created_at, action, user_email, details')
      .eq('entity', 'aniversarios')
      .gte('created_at', `${from}T00:00:00-03:00`)
      .lte('created_at', `${to}T23:59:59.999-03:00`)
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data || []) as SendRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Relatórios › Envios de e-mails de aniversário */
export const BirthdayEmailsReport: React.FC = () => {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayISO());
  const [result, setResult] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SendRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    loadSends(from || '2000-01-01', to || todayISO())
      .then((r) => { if (alive) setRows(r); })
      .catch((err) => { if (alive) setError(err?.message || 'Não foi possível carregar os envios.'); });
    return () => { alive = false; };
  }, [from, to]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || [])
      .filter((r) => !result || r.action === result)
      .filter((r) => !q || [r.details?.nome, r.details?.email].some((v) => v?.toLowerCase().includes(q)));
  }, [rows, result, search]);

  const section: ReportSection<SendRow> = {
    title: 'Envios de aniversário',
    columns: COLUMNS,
    rows: filtered,
    empty: 'Nenhum envio no período.',
  };
  const sent = (rows || []).filter((r) => r.action === 'email_sent').length;
  const failed = (rows || []).filter((r) => r.action === 'email_failed').length;
  const period = `${from.split('-').reverse().join('/')} a ${to.split('-').reverse().join('/')}`;

  return (
    <div className="space-y-4">
      <FilterBar>
        <Field label="De"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
        <Field label="até"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
        <Field label="Resultado">
          <select value={result} onChange={(e) => setResult(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            <option value="email_sent">Enviados</option>
            <option value="email_failed">Falhas</option>
          </select>
        </Field>
        <Field label="Buscar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou e-mail" className={`${inputCls} w-52`} />
        </Field>
        <div className="ml-auto">
          <ReportActions title="Envios de e-mails de aniversário" subtitle={`Período: ${period}`} fileSlug="envios_aniversario" sections={[section]} landscape />
        </div>
      </FilterBar>

      {error && <ReportError message={error} />}
      {!rows && !error && <ReportLoading />}
      {rows && (
        <>
          <StatCards items={[
            { label: 'e-mails enviados', value: sent, tone: 'emerald' },
            { label: 'falhas', value: failed, tone: failed ? 'rose' : 'slate' },
            { label: 'aniversariantes', value: new Set(rows.map((r) => r.details?.email)).size, tone: 'blue' },
            { label: 'envios manuais', value: rows.filter((r) => r.details?.origem === 'manual').length },
          ]} />
          <ReportTable section={section} showTitle={false} />
        </>
      )}
    </div>
  );
};
