import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, CreditCard, Wrench, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { SubscriptionService, costInMonth, dueDateInMonth, addMonths, currentMonth, brl, formatDate, formatMonth, PERIODICITY_LABEL } from '../services/subscriptionService';
import { MaintenanceService } from '../services/maintenanceService';
import { Subscription } from '../types/subscription';
import { Maintenance } from '../types/maintenance';
import { exportFinanceToExcel } from '../lib/financeExport';

// Data em que o custo da manutenção conta: conclusão (se concluída) ou abertura.
const maintenanceDate = (m: Maintenance) => (m.status === 'concluida' && m.completed_at ? m.completed_at : m.opened_at);
const maintenanceMonth = (m: Maintenance) => `${maintenanceDate(m).slice(0, 7)}-01`;

const countsAsExpense = (m: Maintenance) => m.status !== 'cancelada' && (m.cost || 0) > 0;

export const Finance: React.FC = () => {
  const [month, setMonth] = useState(currentMonth());
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [maints, setMaints] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const errs: string[] = [];
    await Promise.all([
      SubscriptionService.list().then(setSubs).catch((e) => errs.push(`Assinaturas: ${e.message}`)),
      MaintenanceService.getMaintenances().then(setMaints).catch((e) => errs.push(`Manutenções: ${e.message}`)),
    ]);
    setErrors(errs);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const licenseRows = useMemo(
    () =>
      subs
        .map((s) => ({ sub: s, amount: costInMonth(s, month), due: dueDateInMonth(s, month) }))
        .filter((r) => r.amount > 0)
        .sort((a, b) => a.due.localeCompare(b.due)),
    [subs, month]
  );
  const maintenanceRows = useMemo(
    () => maints.filter((m) => countsAsExpense(m) && maintenanceMonth(m) === month),
    [maints, month]
  );

  const licensesTotal = licenseRows.reduce((s, r) => s + r.amount, 0);
  const maintenanceTotal = maintenanceRows.reduce((s, m) => s + (m.cost || 0), 0);
  const total = licensesTotal + maintenanceTotal;

  // Evolução: 5 meses anteriores + mês escolhido
  const history = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5)).map((m) => {
        const lic = subs.reduce((s, sub) => s + costInMonth(sub, m), 0);
        const man = maints.filter((x) => countsAsExpense(x) && maintenanceMonth(x) === m).reduce((s, x) => s + (x.cost || 0), 0);
        return { month: m, lic, man, total: lic + man };
      }),
    [subs, maints, month]
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportFinanceToExcel({ month, licenses: licenseRows, maintenances: maintenanceRows, maintenanceDate, history });
    } catch (e: any) {
      setErrors((prev) => [...prev, `Exportação: ${e.message}`]);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financeiro</h2>
          <p className="text-slate-500 text-sm mt-1">
            Acompanhamento dos gastos do mês com licenças e manutenções. O ERP apenas registra e mostra os custos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(addMonths(month, -1))} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50" title="Mês anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          />
          <button onClick={() => setMonth(addMonths(month, 1))} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50" title="Próximo mês">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={load} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50" title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            disabled={loading || exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" /> {exporting ? 'Gerando...' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {errors.map((e) => (
        <div key={e} className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{e}</span>
        </div>
      ))}

      {/* Totais do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Total icon={<Wallet className="w-5 h-5 text-blue-600" />} label={`Total de ${formatMonth(month)}`} value={brl(total)} strong />
        <Total icon={<CreditCard className="w-5 h-5 text-purple-600" />} label="Licenças e assinaturas" value={brl(licensesTotal)} hint={`${licenseRows.length} a pagar no mês`} />
        <Total icon={<Wrench className="w-5 h-5 text-amber-600" />} label="Manutenções" value={brl(maintenanceTotal)} hint={`${maintenanceRows.length} ordem(ns) com custo`} />
      </div>

      {/* Licenças do mês */}
      <Section title="Licenças e assinaturas a pagar no mês" icon={<CreditCard className="w-5 h-5 text-purple-600" />} total={licensesTotal}>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3">Serviço</th>
              <th className="px-5 py-3">Fornecedor</th>
              <th className="px-5 py-3">Periodicidade</th>
              <th className="px-5 py-3">Vencimento</th>
              <th className="px-5 py-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {licenseRows.map(({ sub, amount, due }) => (
              <tr key={sub.id}>
                <td className="px-5 py-3 font-semibold text-slate-800">{sub.service_name}</td>
                <td className="px-5 py-3">{sub.provider || '—'}</td>
                <td className="px-5 py-3">{PERIODICITY_LABEL[sub.periodicity]}</td>
                <td className="px-5 py-3">{formatDate(due)}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-800">{brl(amount)}</td>
              </tr>
            ))}
            {licenseRows.length === 0 && <Empty cols={5} text="Nenhuma licença a pagar neste mês." />}
          </tbody>
        </table>
      </Section>

      {/* Manutenções do mês */}
      <Section title="Gastos com manutenção no mês" icon={<Wrench className="w-5 h-5 text-amber-600" />} total={maintenanceTotal}>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3">Equipamento</th>
              <th className="px-5 py-3">Problema</th>
              <th className="px-5 py-3">Fornecedor</th>
              <th className="px-5 py-3">Situação</th>
              <th className="px-5 py-3">Data</th>
              <th className="px-5 py-3 text-right">Custo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {maintenanceRows.map((m) => (
              <tr key={m.id}>
                <td className="px-5 py-3">
                  <div className="font-semibold text-slate-800">{m.patrimony}</div>
                  <div className="text-xs text-slate-500">{m.equipment}</div>
                </td>
                <td className="px-5 py-3 max-w-xs truncate" title={m.issue}>{m.issue}</td>
                <td className="px-5 py-3">{m.provider || '—'}</td>
                <td className="px-5 py-3">
                  {m.status === 'concluida' ? (
                    <span className="text-emerald-700 font-semibold text-xs">Concluída</span>
                  ) : (
                    <span className="text-amber-700 font-semibold text-xs">Em andamento</span>
                  )}
                </td>
                <td className="px-5 py-3">{formatDate(maintenanceDate(m))}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-800">{brl(m.cost || 0)}</td>
              </tr>
            ))}
            {maintenanceRows.length === 0 && <Empty cols={6} text="Nenhum gasto com manutenção neste mês." />}
          </tbody>
        </table>
      </Section>

      {/* Evolução */}
      <Section title="Evolução dos últimos 6 meses" icon={<Wallet className="w-5 h-5 text-blue-600" />}>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3">Mês</th>
              <th className="px-5 py-3 text-right">Licenças</th>
              <th className="px-5 py-3 text-right">Manutenções</th>
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((h) => (
              <tr
                key={h.month}
                onClick={() => setMonth(h.month)}
                className={`cursor-pointer hover:bg-slate-50 ${h.month === month ? 'bg-blue-50/60 font-semibold' : ''}`}
              >
                <td className="px-5 py-3 text-slate-800">{formatMonth(h.month)}</td>
                <td className="px-5 py-3 text-right">{brl(h.lic)}</td>
                <td className="px-5 py-3 text-right">{brl(h.man)}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-800">{brl(h.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <p className="text-xs text-slate-400">
        Licenças: valor cadastrado em cada assinatura ativa (anuais contam no mês da renovação).
        Manutenções: custo registrado na ordem, no mês de conclusão — ou de abertura, se ainda estiver em andamento. Canceladas não entram.
      </p>
    </div>
  );
};

const Total: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string; strong?: boolean }> = ({ icon, label, value, hint, strong }) => (
  <div className={`p-5 rounded-2xl border shadow-sm ${strong ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
    <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-semibold">
      {icon} {label}
    </div>
    <div className="text-2xl font-bold text-slate-800 mt-2">{value}</div>
    {hint && <span className="text-xs text-slate-500">{hint}</span>}
  </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; total?: number; children: React.ReactNode }> = ({ title, icon, total, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
      <h3 className="font-bold text-slate-800 flex items-center gap-2">{icon} {title}</h3>
      {total !== undefined && <span className="text-sm font-bold text-slate-800">{brl(total)}</span>}
    </div>
    <div className="overflow-x-auto">{children}</div>
  </div>
);

const Empty: React.FC<{ cols: number; text: string }> = ({ cols, text }) => (
  <tr>
    <td colSpan={cols} className="px-6 py-8 text-center text-sm text-slate-500">{text}</td>
  </tr>
);
