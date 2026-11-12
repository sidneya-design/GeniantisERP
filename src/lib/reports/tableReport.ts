// Base comum dos relatórios em tabela: formatação, impressão (HTML) e Excel.
import { ORGANIZATION_NAME } from '../termTemplate';

export type CellValue = string | number | null | undefined;

export interface ReportColumn<T> {
  header: string;
  value: (row: T) => CellValue;
  /** date = AAAA-MM-DD; money = número em R$ */
  kind?: 'text' | 'date' | 'money' | 'number';
  /** Largura no Excel (caracteres) */
  width?: number;
  mono?: boolean;
}

export interface ReportSection<T = any> {
  title: string;
  columns: ReportColumn<T>[];
  rows: T[];
  /** Linha de total (texto) mostrada abaixo da tabela */
  footer?: string;
  empty?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatCell(value: CellValue, kind: ReportColumn<any>['kind'] = 'text'): string {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'date' && typeof value === 'string') {
    const [y, m, d] = value.slice(0, 10).split('-');
    return d && m && y ? `${d}/${m}/${y}` : value;
  }
  if (kind === 'money' && typeof value === 'number') {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (kind === 'number' && typeof value === 'number') return value.toLocaleString('pt-BR');
  return String(value);
}

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatDateBR = (iso: string) => formatCell(iso, 'date');

/** Dias entre hoje e a data (negativo = já passou) */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = todayISO().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

const esc = (value: string) => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

/** Abre a janela de impressão com as seções do relatório (dá para salvar como PDF) */
export function printReport(opts: {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  generatedBy: string;
  landscape?: boolean;
}): boolean {
  const w = window.open('', '_blank', 'width=1000,height=750');
  if (!w) return false;
  const today = formatDateBR(todayISO());

  const sections = opts.sections.map((s) => {
    const head = s.columns.map((c) => `<th>${esc(c.header)}</th>`).join('');
    const body = s.rows.length
      ? s.rows.map((r) => `<tr>${s.columns.map((c) => {
          const cls = [c.mono ? 'mono' : '', c.kind === 'money' || c.kind === 'number' ? 'num' : ''].filter(Boolean).join(' ');
          return `<td${cls ? ` class="${cls}"` : ''}>${esc(formatCell(c.value(r), c.kind)).replace(/\n/g, '<br>')}</td>`;
        }).join('')}</tr>`).join('')
      : `<tr><td colspan="${s.columns.length}" class="empty">${esc(s.empty || 'Nenhum registro.')}</td></tr>`;
    return `<h2>${esc(s.title)} <span>(${s.rows.length})</span></h2>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      ${s.footer ? `<div class="foot">${esc(s.footer)}</div>` : ''}`;
  }).join('');

  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${esc(`${opts.title} - ${today.replace(/\//g, '-')}`)}</title><style>
    @page { size: A4 ${opts.landscape ? 'landscape' : 'portrait'}; margin: 1.5cm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 24px auto; max-width: ${opts.landscape ? '1100px' : '780px'}; font-size: 12px; line-height: 1.4; }
    .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .top img { height: 38px; } .top .gen { font-size: 10px; color: #6b7280; text-align: right; }
    h1 { font-size: 15px; margin: 0 0 2px; text-align: center; } .sub { text-align: center; color: #4b5563; font-size: 11px; margin-bottom: 14px; }
    h2 { font-size: 12px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .03em; color: #374151; } h2 span { color: #9ca3af; font-weight: normal; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; vertical-align: top; font-size: 11px; }
    th { background: #f3f4f6; } .mono { font-family: monospace; white-space: nowrap; } .num { text-align: right; white-space: nowrap; }
    .empty { text-align: center; color: #6b7280; padding: 10px; } .foot { margin-top: 4px; font-size: 11px; color: #374151; text-align: right; }
    tr { page-break-inside: avoid; }
  </style></head><body>
    <div class="top"><img src="${window.location.origin}/logo-geniantis.svg" alt="${esc(ORGANIZATION_NAME)}">
      <div class="gen">Gerado em ${today}<br>por ${esc(opts.generatedBy)}</div></div>
    <h1>${esc(opts.title.toUpperCase())}</h1>
    ${opts.subtitle ? `<div class="sub">${esc(opts.subtitle)}</div>` : ''}
    ${sections}
  </body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
  return true;
}

/** Excel com uma aba por seção */
export async function exportReportExcel(fileName: string, sections: ReportSection[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GeniantisERP';
  wb.created = new Date();
  const used = new Set<string>();

  for (const s of sections) {
    // Nome de aba: até 31 caracteres, sem []:*?/\ e sem repetir
    let name = s.title.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Relatório';
    for (let n = 2; used.has(name); n += 1) name = `${name.slice(0, 28)} ${n}`;
    used.add(name);

    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = s.columns.map((c, i) => ({
      header: c.header,
      key: `c${i}`,
      width: c.width || Math.max(12, c.header.length + 4),
      style: c.kind === 'date' ? { numFmt: 'dd/mm/yyyy' } : c.kind === 'money' ? { numFmt: '"R$" #,##0.00' } : {},
    }));
    for (const r of s.rows) {
      const row: Record<string, any> = {};
      s.columns.forEach((c, i) => {
        const v = c.value(r);
        if (v === null || v === undefined || v === '') row[`c${i}`] = null;
        else if (c.kind === 'date' && typeof v === 'string') {
          const [y, m, d] = v.slice(0, 10).split('-').map(Number);
          row[`c${i}`] = new Date(y, m - 1, d, 12);
        } else row[`c${i}`] = v;
      });
      ws.addRow(row);
    }
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    if (s.columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
