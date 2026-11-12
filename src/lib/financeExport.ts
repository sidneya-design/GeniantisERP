import { formatMonth } from '../services/subscriptionService';
import { CATEGORY_LABEL, CATEGORY_ORDER, ExpenseCategory, ExpenseItem } from './finance';

export interface FinanceExportData {
  month: string; // YYYY-MM-01
  items: ExpenseItem[];
  history: ({ month: string; total: number } & Record<ExpenseCategory, number>)[];
}

const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E293B' } };

// Nome da aba no Excel (máx. 31 caracteres, sem / \ ? * [ ])
const SHEET_NAME: Record<ExpenseCategory, string> = {
  licencas: 'Licenças',
  manutencoes: 'Manutenções',
  dominios: 'Domínios',
  ativos: 'Compras de ativos',
};

const COLUMNS: Record<ExpenseCategory, [string, string, string]> = {
  licencas: ['Serviço', 'Fornecedor', 'Periodicidade'],
  manutencoes: ['Equipamento', 'Problema / fornecedor', 'Situação'],
  dominios: ['Domínio', 'Registradora', 'Situação'],
  ativos: ['Ativo', 'Categoria', 'Tipo'],
};

// Datas como Date local ao meio-dia: o Excel mostra o dia certo sem deslocar fuso
const toDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export async function exportFinanceToExcel(data: FinanceExportData): Promise<void> {
  // Carregado sob demanda: a biblioteca só é baixada quando alguém exporta
  const ExcelJS = (await import('exceljs')).default;
  type Worksheet = import('exceljs').Worksheet;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GeniantisERP';
  wb.created = new Date();

  const monthLabel = formatMonth(data.month);
  const byCat = (c: ExpenseCategory) => data.items.filter((i) => i.category === c);
  const sum = (list: ExpenseItem[]) => list.reduce((s, i) => s + i.amount, 0);

  const styleHeader = (ws: Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = HEADER_FILL;
    row.alignment = { vertical: 'middle' };
    row.height = 20;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };

  const addTotalRow = (ws: Worksheet, label: string, col: string, value: number) => {
    const row = ws.addRow({});
    row.getCell(1).value = label;
    row.getCell(col).value = value;
    row.getCell(col).numFmt = BRL;
    row.font = { bold: true };
    row.border = { top: { style: 'thin' } };
  };

  // 1. Resumo
  const resumo = wb.addWorksheet('Resumo');
  resumo.columns = [
    { header: `Gastos de ${monthLabel}`, key: 'item', width: 34 },
    { header: 'Lançamentos', key: 'qtd', width: 13 },
    { header: 'Valor', key: 'valor', width: 18, style: { numFmt: BRL } },
  ];
  styleHeader(resumo);
  CATEGORY_ORDER.forEach((c) => resumo.addRow({ item: CATEGORY_LABEL[c], qtd: byCat(c).length, valor: sum(byCat(c)) }));
  addTotalRow(resumo, 'Total do mês', 'C', sum(data.items));
  resumo.addRow({});
  resumo.addRow({ item: `Gerado em ${new Date().toLocaleString('pt-BR')}` }).font = { italic: true, color: { argb: 'FF64748B' } };

  // 2. Uma aba por categoria
  for (const c of CATEGORY_ORDER) {
    const [c1, c2, c3] = COLUMNS[c];
    const ws = wb.addWorksheet(SHEET_NAME[c]);
    ws.columns = [
      { header: c1, key: 'titulo', width: 34 },
      { header: c2, key: 'detalhe', width: 40 },
      { header: c3, key: 'tag', width: 22 },
      { header: 'Data', key: 'data', width: 13, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Valor', key: 'valor', width: 16, style: { numFmt: BRL } },
    ];
    styleHeader(ws);
    byCat(c).forEach((i) => ws.addRow({ titulo: i.title, detalhe: i.detail, tag: i.tag, data: toDate(i.date), valor: i.amount }));
    addTotalRow(ws, 'Total', 'E', sum(byCat(c)));
  }

  // 3. Evolução
  const evo = wb.addWorksheet('Evolução 6 meses');
  evo.columns = [
    { header: 'Mês', key: 'mes', width: 22 },
    ...CATEGORY_ORDER.map((c) => ({ header: CATEGORY_LABEL[c], key: c, width: 20, style: { numFmt: BRL } })),
    { header: 'Total', key: 'total', width: 16, style: { numFmt: BRL } },
  ];
  styleHeader(evo);
  data.history.forEach((h) =>
    evo.addRow({ mes: formatMonth(h.month), ...Object.fromEntries(CATEGORY_ORDER.map((c) => [c, h[c]])), total: h.total })
  );

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `financeiro-${data.month.slice(0, 7)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
