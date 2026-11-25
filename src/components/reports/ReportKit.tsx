// Peças comuns das telas de relatório: carregamento, cartões de resumo, filtros,
// botões de imprimir/Excel e tabela.
import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, Loader2, Printer, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { exportReportExcel, formatCell, printReport, ReportSection, todayISO } from '../../lib/reports/tableReport';

/** Carrega os dados do relatório uma vez */
export function useReportData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) setError(err?.message || 'Não foi possível carregar os dados do relatório.'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, error, loading: !data && !error };
}

export const ReportLoading: React.FC = () => (
  <div className="p-6 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
);

export const ReportError: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
    <ShieldAlert className="w-5 h-5 shrink-0" /> {message}
  </div>
);

type Tone = 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';
const TONE: Record<Tone, string> = {
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
  blue: 'bg-blue-50 border-blue-100 text-blue-700',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  amber: 'bg-amber-50 border-amber-100 text-amber-700',
  rose: 'bg-rose-50 border-rose-100 text-rose-700',
};

export const StatCards: React.FC<{ items: { label: string; value: string | number; tone?: Tone }[] }> = ({ items }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {items.map((i) => (
      <div key={i.label} className={`p-3 rounded-xl border ${TONE[i.tone || 'slate']}`}>
        <span className="block text-xl font-bold">{i.value}</span>
        <span className="text-xs">{i.label}</span>
      </div>
    ))}
  </div>
);

export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-end gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">{children}</div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</span>
    {children}
  </label>
);

export const inputCls = 'px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white';

/** Botões Imprimir / Excel para as seções do relatório */
export const ReportActions: React.FC<{
  title: string;
  fileSlug: string;
  subtitle?: string;
  sections: ReportSection[];
  landscape?: boolean;
}> = ({ title, fileSlug, subtitle, sections, landscape }) => {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const empty = sections.every((s) => !s.rows.length);

  const onPrint = () => {
    const ok = printReport({ title, subtitle, sections, landscape, generatedBy: profile?.full_name || profile?.email || '' });
    setMsg(ok ? null : 'Não foi possível abrir a impressão. Verifique o bloqueador de pop-ups.');
  };
  const onExcel = async () => {
    setBusy(true);
    try {
      await exportReportExcel(`${fileSlug}_${todayISO()}.xlsx`, sections);
      setMsg(null);
    } catch (err: any) {
      setMsg(err?.message || 'Não foi possível gerar o Excel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" disabled={empty} onClick={onPrint} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold">
          <Printer className="w-4 h-4" /> Imprimir / PDF
        </button>
        <button type="button" disabled={empty || busy} onClick={onExcel} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-semibold">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
        </button>
      </div>
      {msg && <span className="text-xs text-rose-700">{msg}</span>}
    </div>
  );
};

/** Tabela de uma seção do relatório */
export const ReportTable: React.FC<{ section: ReportSection; showTitle?: boolean }> = ({ section, showTitle = true }) => (
  <div className="space-y-2">
    {showTitle && (
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        {section.title} <span className="text-slate-400 font-normal">({section.rows.length})</span>
      </h4>
    )}
    <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[520px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 sticky top-0">
          <tr>
            {section.columns.map((c) => (
              <th key={c.header} className={`px-3 py-2 font-semibold whitespace-nowrap ${c.kind === 'money' || c.kind === 'number' ? 'text-right' : 'text-left'}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {section.rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50/70">
              {section.columns.map((c) => (
                <td
                  key={c.header}
                  className={`px-3 py-2 text-xs text-slate-700 whitespace-pre-line ${c.mono ? 'font-mono' : ''} ${c.kind === 'money' || c.kind === 'number' ? 'text-right whitespace-nowrap' : ''}`}
                >
                  {formatCell(c.value(r), c.kind)}
                </td>
              ))}
            </tr>
          ))}
          {!section.rows.length && (
            <tr><td colSpan={section.columns.length} className="px-3 py-8 text-center text-xs text-slate-500">{section.empty || 'Nenhum registro.'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
    {section.footer && <p className="text-xs text-slate-600 text-right">{section.footer}</p>}
  </div>
);
