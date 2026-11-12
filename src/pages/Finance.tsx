import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet, CreditCard, Wrench, Globe, Laptop, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, FileSpreadsheet,
} from 'lucide-react';
import { addMonths, currentMonth, brl, formatDate, formatMonth } from '../services/subscriptionService';
import {
  CATEGORY_LABEL, CATEGORY_ORDER, ExpenseCategory, ExpenseItem, expensesInMonth, loadFinanceData, totalsByCategory,
} from '../lib/finance';
import { exportFinanceToExcel } from '../lib/financeExport';

const ICON: Record<ExpenseCategory, React.ReactNode> = {
  licencas: <CreditCard className="w-5 h-5 text-purple-600" />,
  manutencoes: <Wrench className="w-5 h-5 text-amber-600" />,
  dominios: <Globe className="w-5 h-5 text-cyan-600" />,
  ativos: <Laptop className="w-5 h-5 text-emerald-600" />,
};

// Cabeçalhos das colunas "título / detalhe / situação" por categoria
const COLUMNS: Record<ExpenseCategory, [string, string, string]> = {
  licencas: ['Serviço', 'Fornecedor', 'Periodicidade'],
  manutencoes: ['Equipamento', 'Problema / fornecedor', 'Situação'],
  dominios: ['Domínio', 'Registradora', 'Situação'],
  ativos: ['Ativo', 'Categoria', 'Tipo'],
};

const EMPTY: Record<ExpenseCategory, string> = {
  licencas: 'Nenhuma licença a pagar neste mês.',
  manutencoes: 'Nenhum gasto com manutenção neste mês.',
  dominios: 'Nenhuma renovação de domínio neste mês.',
  ativos: 'Nenhuma compra de ativo neste mês.',
};

export const Finance: React.FC = () => {
  const [month, setMonth] = useState(currentMonth());
  const [raw, setRaw] = useState<Awaited<ReturnType<typeof loadFinanceData>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRaw(await loadFinanceData());
      setErrors([]);
    } catch (e: any) {
      setErrors([e.message]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const items = useMemo(() => (raw ? expensesInMonth(raw, month) : []), [raw, month]);
  const totals = useMemo(() => totalsByCategory(items), [items]);
  const total = items.reduce((s, i) => s + i.amount, 0);

  // Evolução: 5 meses anteriores + mês escolhido
  const history = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5)).map((m) => {
        const t = raw ? totalsByCategory(expensesInMonth(raw, m)) : totalsByCategory([]);
        return { month: m, ...t, total: CATEGORY_ORDER.reduce((s, c) => s + t[c], 0) };
      }),
    [raw, month]
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportFinanceToExcel({ month, items, history });
    } catch (e: any) {
      setErrors((prev) => [...prev, `Exportação: ${e.message}`]);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financeiro</h2>
          <p className="text-slate-500 text-sm mt-1">
            Tudo que tem custo no ERP: licenças, manutenções, domínios e compras de ativos. O ERP apenas registra e mostra os custos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl border shadow-sm bg-blue-50 border-blue-200 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-semibold">
            <Wallet className="w-5 h-5 text-blue-600" /> Total de {formatMonth(month)}
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-2">{brl(total)}</div>
          <span className="text-xs text-slate-500">{items.length} lançamento(s)</span>
        </div>
        {CATEGORY_ORDER.map((c) => (
          <div key={c} className="p-5 rounded-2xl border shadow-sm bg-white border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-semibold">
              {ICON[c]} {CATEGORY_LABEL[c]}
            </div>
            <div className="text-xl font-bold text-slate-800 mt-2">{brl(totals[c])}</div>
            <span className="text-xs text-slate-500">{items.filter((i) => i.category === c).length} no mês</span>
          </div>
        ))}
      </div>

      {/* Uma seção por categoria */}
      {CATEGORY_ORDER.map((c) => (
        <CategorySection key={c} category={c} items={items.filter((i) => i.category === c)} total={totals[c]} />
      ))}

      {/* Evolução */}
      <Section title="Evolução dos últimos 6 meses" icon={<Wallet className="w-5 h-5 text-blue-600" />}>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3">Mês</th>
              {CATEGORY_ORDER.map((c) => (
                <th key={c} className="px-5 py-3 text-right whitespace-nowrap">{CATEGORY_LABEL[c]}</th>
              ))}
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
                <td className="px-5 py-3 text-slate-800 whitespace-nowrap">{formatMonth(h.month)}</td>
                {CATEGORY_ORDER.map((c) => (
                  <td key={c} className="px-5 py-3 text-right">{brl(h[c])}</td>
                ))}
                <td className="px-5 py-3 text-right font-semibold text-slate-800">{brl(h.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <p className="text-xs text-slate-400 leading-relaxed">
        <strong>Licenças:</strong> valor de cada assinatura ativa, no mês do vencimento (anuais no mês da renovação).{' '}
        <strong>Manutenções:</strong> custo da ordem, no mês de conclusão — ou de abertura, se em andamento; canceladas não entram.{' '}
        <strong>Domínios:</strong> renovação registrada entra no mês em que foi renovada; domínio ainda não renovado entra como previsto no mês do vencimento.{' '}
        <strong>Compras de ativos:</strong> custo de aquisição, no mês da aquisição.
      </p>
    </div>
  );
};

const CategorySection: React.FC<{ category: ExpenseCategory; items: ExpenseItem[]; total: number }> = ({ category, items, total }) => {
  const [col1, col2, col3] = COLUMNS[category];
  return (
    <Section title={CATEGORY_LABEL[category]} icon={ICON[category]} total={total}>
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
          <tr>
            <th className="px-5 py-3">{col1}</th>
            <th className="px-5 py-3">{col2}</th>
            <th className="px-5 py-3">{col3}</th>
            <th className="px-5 py-3">Data</th>
            <th className="px-5 py-3 text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((i) => (
            <tr key={i.id}>
              <td className="px-5 py-3 font-semibold text-slate-800">{i.title}</td>
              <td className="px-5 py-3 max-w-xs truncate" title={i.detail}>{i.detail || '—'}</td>
              <td className="px-5 py-3 text-xs">
                <span className={i.tag.startsWith('Previsto') ? 'text-amber-700 font-semibold' : ''}>{i.tag}</span>
              </td>
              <td className="px-5 py-3 whitespace-nowrap">{formatDate(i.date)}</td>
              <td className="px-5 py-3 text-right font-semibold text-slate-800">{brl(i.amount)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-6 text-center text-sm text-slate-500">{EMPTY[category]}</td>
            </tr>
          )}
        </tbody>
      </table>
    </Section>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; total?: number; children: React.ReactNode }> = ({ title, icon, total, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
      <h3 className="font-bold text-slate-800 flex items-center gap-2">{icon} {title}</h3>
      {total !== undefined && <span className="text-sm font-bold text-slate-800">{brl(total)}</span>}
    </div>
    <div className="overflow-x-auto">{children}</div>
  </div>
);
