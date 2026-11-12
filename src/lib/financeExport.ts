import type { Subscription } from '../types/subscription';
import type { Maintenance } from '../types/maintenance';
import { PERIODICITY_LABEL, formatMonth } from '../services/subscriptionService';

export interface FinanceExportData {
  month: string; // YYYY-MM-01
  licenses: { sub: Subscription; amount: number; due: string }[];
  maintenances: Maintenance[];
  maintenanceDate: (m: Maintenance) => string;
  history: { month: string; lic: number; man: number; total: number }[];
}

const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E293B' } };

// Datas como Date local ao meio-dia: o Excel mostra o dia certo sem deslocar fuso
const toDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export async function exportFinanceToExcel(data: FinanceExportData): Promise<void> {
  // Carregado sob demanda: a biblioteca só é baixada quando alguém exporta
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GeniantisERP';
  wb.created = new Date();

  const monthLabel = formatMonth(data.month);
  const licTotal = data.licenses.reduce((s, r) => s + r.amount, 0);
  const manTotal = data.maintenances.reduce((s, m) => s + (m.cost || 0), 0);

  const styleHeader = (ws: import('exceljs').Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = HEADER_FILL;
    row.alignment = { vertical: 'middle' };
    row.height = 20;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };

  const addTotalRow = (ws: import('exceljs').Worksheet, label: string, col: string, value: number) => {
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
    { header: 'Valor', key: 'valor', width: 18, style: { numFmt: BRL } },
  ];
  styleHeader(resumo);
  resumo.addRow({ item: `Licenças e assinaturas (${data.licenses.length})`, valor: licTotal });
  resumo.addRow({ item: `Manutenções (${data.maintenances.length})`, valor: manTotal });
  addTotalRow(resumo, 'Total do mês', 'B', licTotal + manTotal);
  resumo.addRow({});
  resumo.addRow({ item: `Gerado em ${new Date().toLocaleString('pt-BR')}` }).font = { italic: true, color: { argb: 'FF64748B' } };

  // 2. Licenças
  const lic = wb.addWorksheet('Licenças');
  lic.columns = [
    { header: 'Serviço', key: 'servico', width: 32 },
    { header: 'Fornecedor', key: 'fornecedor', width: 26 },
    { header: 'Categoria', key: 'categoria', width: 24 },
    { header: 'Periodicidade', key: 'periodicidade', width: 24 },
    { header: 'Licenças', key: 'licencas', width: 10 },
    { header: 'Vencimento', key: 'vencimento', width: 13, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Valor', key: 'valor', width: 16, style: { numFmt: BRL } },
  ];
  styleHeader(lic);
  data.licenses.forEach(({ sub, amount, due }) =>
    lic.addRow({
      servico: sub.service_name,
      fornecedor: sub.provider || '',
      categoria: sub.category || '',
      periodicidade: PERIODICITY_LABEL[sub.periodicity],
      licencas: sub.total_licenses,
      vencimento: toDate(due),
      valor: amount,
    })
  );
  addTotalRow(lic, 'Total', 'G', licTotal);

  // 3. Manutenções
  const man = wb.addWorksheet('Manutenções');
  man.columns = [
    { header: 'Patrimônio', key: 'patrimonio', width: 14 },
    { header: 'Equipamento', key: 'equipamento', width: 30 },
    { header: 'Problema', key: 'problema', width: 40 },
    { header: 'Fornecedor', key: 'fornecedor', width: 24 },
    { header: 'Situação', key: 'situacao', width: 14 },
    { header: 'Data', key: 'data', width: 13, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Custo', key: 'custo', width: 16, style: { numFmt: BRL } },
  ];
  styleHeader(man);
  data.maintenances.forEach((m) =>
    man.addRow({
      patrimonio: m.patrimony,
      equipamento: m.equipment,
      problema: m.issue,
      fornecedor: m.provider || '',
      situacao: m.status === 'concluida' ? 'Concluída' : 'Em andamento',
      data: toDate(data.maintenanceDate(m)),
      custo: m.cost || 0,
    })
  );
  addTotalRow(man, 'Total', 'G', manTotal);

  // 4. Evolução
  const evo = wb.addWorksheet('Evolução 6 meses');
  evo.columns = [
    { header: 'Mês', key: 'mes', width: 22 },
    { header: 'Licenças', key: 'lic', width: 16, style: { numFmt: BRL } },
    { header: 'Manutenções', key: 'man', width: 16, style: { numFmt: BRL } },
    { header: 'Total', key: 'total', width: 16, style: { numFmt: BRL } },
  ];
  styleHeader(evo);
  data.history.forEach((h) => evo.addRow({ mes: formatMonth(h.month), lic: h.lic, man: h.man, total: h.total }));

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
