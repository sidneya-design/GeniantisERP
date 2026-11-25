// Excel com as folhas de ponto do mês: aba Resumo + uma aba (espelho) por funcionário.
// O exceljs só é baixado quando alguém exporta.
import {
  DAY_STATUS, KIND_LABEL, TimeDay, TimeOverviewRow, TimesheetService, WEEKDAY_SHORT,
  fmtMinutes, fmtTime, monthLabel, monthRange,
} from '../../services/timesheetService';
import { formatDate } from '../../services/subscriptionService';

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E293B' } };

// Nome de aba: máx. 31 caracteres, sem : \ / ? * [ ] e sem repetir
function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Funcionário';
  let n = base;
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 31 - ` (${i})`.length)} (${i})`;
  used.add(n.toLowerCase());
  return n;
}

export async function exportTimesheetsToExcel(
  month: string,
  rows: TimeOverviewRow[],
  fileName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const { from, to } = monthRange(month);

  // Busca os espelhos em lotes para não sobrecarregar o banco
  const days: TimeDay[][] = [];
  const BATCH = 5;
  for (let i = 0; i < rows.length; i += BATCH) {
    const part = await Promise.all(rows.slice(i, i + BATCH).map((r) => TimesheetService.daily(r.employee_id, from, to)));
    days.push(...part);
    onProgress?.(Math.min(i + BATCH, rows.length), rows.length);
  }

  const ExcelJS = (await import('exceljs')).default;
  type Worksheet = import('exceljs').Worksheet;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GeniantisERP';
  wb.created = new Date();

  const styleHeader = (ws: Worksheet, rowNo = 1) => {
    const row = ws.getRow(rowNo);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = HEADER_FILL;
    row.alignment = { vertical: 'middle' };
    row.height = 20;
    ws.views = [{ state: 'frozen', ySplit: rowNo }];
  };

  const used = new Set<string>();

  // 1. Resumo
  const resumo = wb.addWorksheet(sheetName('Resumo', used));
  resumo.columns = [
    { header: 'Funcionário', key: 'nome', width: 32 },
    { header: 'Departamento', key: 'dep', width: 22 },
    { header: 'Previsto', key: 'prev', width: 11 },
    { header: 'Trabalhado', key: 'trab', width: 12 },
    { header: 'Saldo do mês', key: 'saldo', width: 13 },
    { header: 'Faltas', key: 'faltas', width: 8 },
    { header: 'Dias incompletos', key: 'inc', width: 16 },
    { header: 'Banco de horas', key: 'banco', width: 15 },
    { header: 'Pendências', key: 'pend', width: 11 },
  ];
  styleHeader(resumo);
  rows.forEach((r) =>
    resumo.addRow({
      nome: r.full_name, dep: r.department, prev: fmtMinutes(r.expected_minutes), trab: fmtMinutes(r.worked_minutes),
      saldo: fmtMinutes(r.period_balance, true), faltas: r.absences, inc: r.incomplete_days,
      banco: fmtMinutes(r.bank_total, true), pend: r.pending_requests,
    }),
  );
  resumo.addRow({});
  resumo.addRow({ nome: `Folhas de ponto de ${monthLabel(month)} · gerado em ${new Date().toLocaleString('pt-BR')}` }).font = {
    italic: true, color: { argb: 'FF64748B' },
  };

  // 2. Uma aba por funcionário (espelho do mês)
  rows.forEach((r, idx) => {
    const ws = wb.addWorksheet(sheetName(r.full_name, used));
    ws.getCell('A1').value = r.full_name;
    ws.getCell('A1').font = { bold: true, size: 13 };
    ws.getCell('A2').value = `${r.department || 'Sem departamento'} · ${monthLabel(month)}`;
    ws.getCell('A2').font = { color: { argb: 'FF64748B' } };

    const cols = ['Data', 'Dia', 'Marcações', 'Previsto', 'Trabalhado', 'Saldo', 'Situação', 'Observação'];
    const widths = [12, 6, 30, 10, 11, 10, 14, 28];
    ws.getRow(4).values = cols;
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    styleHeader(ws, 4);

    const list = days[idx];
    list.forEach((d) =>
      ws.addRow([
        formatDate(d.work_date), WEEKDAY_SHORT[d.weekday], d.punches.map(fmtTime).join('  '),
        fmtMinutes(d.expected_minutes), fmtMinutes(d.worked_minutes),
        d.balance_minutes === null ? '' : fmtMinutes(d.balance_minutes, true),
        DAY_STATUS[d.status]?.label || d.status, d.holiday || (d.absence ? KIND_LABEL[d.absence] : ''),
      ]),
    );

    const total = ws.addRow([
      'Total', '', '', fmtMinutes(r.expected_minutes), fmtMinutes(r.worked_minutes), fmtMinutes(r.period_balance, true), '',
      `Banco de horas: ${fmtMinutes(r.bank_total, true)}`,
    ]);
    total.font = { bold: true };
    total.border = { top: { style: 'thin' } };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
