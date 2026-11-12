// Relatório "Itens por funcionário": o que está com cada pessoa agora e o histórico
// de entregas e devoluções. Impressão (HTML) e exportação para Excel.
import { Asset } from '../../types/asset';
import { Employee } from '../../types/employee';
import { Movement } from '../../types/movement';
import { categoryLabel } from '../assetLabels';
import { ORGANIZATION_NAME } from '../termTemplate';

export interface HeldItem {
  asset: Asset;
  /** Data da última entrega deste ativo ao funcionário (se registrada em Entregas) */
  deliveredAt: string | null;
  termStatus: 'assinado' | 'pendente' | null;
  hasSignedPdf: boolean;
}

export interface EmployeeAssets {
  employee: Employee;
  items: HeldItem[];
  history: Movement[];
}

const describe = (a: Asset) => [a.brand, a.model].filter(Boolean).join(' ') || categoryLabel(a.category);

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export function buildEmployeeAssets(employee: Employee, assets: Asset[], movements: Movement[]): EmployeeAssets {
  const history = movements
    .filter((m) => m.employee_id === employee.id)
    .sort((a, b) => (b.movement_date + b.created_at).localeCompare(a.movement_date + a.created_at));

  const items = assets
    .filter((a) => a.assigned_employee_id === employee.id && a.status !== 'baixado')
    .sort((a, b) => a.patrimony.localeCompare(b.patrimony))
    .map((asset) => {
      const delivery = history.find((m) => m.type === 'entrega' && m.asset_ids.includes(asset.id));
      return {
        asset,
        deliveredAt: delivery?.movement_date || null,
        termStatus: delivery?.term_status || null,
        hasSignedPdf: !!delivery?.term_file_path,
      };
    });

  return { employee, items, history };
}

export const termLabel = (item: HeldItem) =>
  !item.termStatus ? 'Sem entrega registrada' : item.termStatus === 'assinado' ? (item.hasSignedPdf ? 'Assinado (PDF anexo)' : 'Assinado') : 'Pendente';

const esc = (value: string) => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

/** HTML para imprimir/salvar em PDF a relação de itens de um funcionário */
export function renderEmployeeAssetsHtml(data: EmployeeAssets, generatedBy: string, origin = window.location.origin): string {
  const e = data.employee;
  const today = new Date().toISOString().slice(0, 10);
  const itemRows = data.items.length
    ? data.items.map((i) => `<tr>
        <td class="mono">${esc(i.asset.patrimony)}</td>
        <td>${esc(describe(i.asset))}</td>
        <td>${esc(categoryLabel(i.asset.category))}</td>
        <td class="mono">${esc(i.asset.serial_number || '—')}</td>
        <td>${formatDate(i.deliveredAt)}</td>
        <td>${esc(termLabel(i))}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty">Nenhum item sob responsabilidade deste funcionário.</td></tr>';

  const historyRows = data.history.map((m) => `<tr>
      <td>${formatDate(m.movement_date)}</td>
      <td>${m.type === 'entrega' ? 'Entrega' : 'Devolução'}</td>
      <td>${m.items.map((i) => `${esc(i.patrimony)} — ${esc(i.description || 'Ativo')}`).join('<br>')}</td>
      <td>${m.term_status === 'assinado' ? 'Assinado' : 'Pendente'}</td>
    </tr>`).join('');

  const title = `Relação de itens - ${e.full_name} - ${formatDate(today).replace(/\//g, '-')}`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page { size: A4; margin: 1.8cm 2cm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; max-width: 760px; margin: 28px auto; font-size: 13px; line-height: 1.45; }
    .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
    .top img { height: 42px; } .top .gen { font-size: 11px; color: #6b7280; text-align: right; }
    h1 { font-size: 15px; text-align: center; margin: 0 0 20px; }
    h2 { font-size: 13px; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: .03em; color: #374151; }
    .info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 14px; }
    .info span { color: #6b7280; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; vertical-align: top; font-size: 12px; }
    th { background: #f3f4f6; } .mono { font-family: monospace; white-space: nowrap; } .empty { text-align: center; color: #6b7280; padding: 14px; }
    .total { margin-top: 6px; font-size: 12px; color: #374151; }
    .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 64px; text-align: center; font-size: 12px; }
    .sigs .line { border-top: 1px solid #111827; margin-bottom: 4px; }
  </style></head><body>
    <div class="top"><img src="${origin}/logo-geniantis.svg" alt="${esc(ORGANIZATION_NAME)}">
      <div class="gen">Gerado em ${formatDate(today)}<br>por ${esc(generatedBy)}</div></div>
    <h1>RELAÇÃO DE ITENS SOB RESPONSABILIDADE DO COLABORADOR</h1>
    <div class="info">
      <div><span>Funcionário:</span> <strong>${esc(e.full_name)}</strong></div>
      <div><span>E-mail:</span> ${esc(e.email || '—')}</div>
      <div><span>Departamento:</span> ${esc(e.department || '—')}</div>
      <div><span>Cargo:</span> ${esc(e.role_title || '—')}</div>
      <div><span>Unidade:</span> ${esc(e.unit || '—')}</div>
      <div><span>Situação:</span> ${e.status === 'ativo' ? 'Ativo' : e.status === 'afastado' ? 'Afastado' : 'Desligado'}</div>
    </div>
    <h2>Itens em posse</h2>
    <table><thead><tr><th>Patrimônio</th><th>Item</th><th>Categoria</th><th>Nº de série</th><th>Entregue em</th><th>Termo</th></tr></thead>
      <tbody>${itemRows}</tbody></table>
    <div class="total">Total: <strong>${data.items.length}</strong> ${data.items.length === 1 ? 'item' : 'itens'}</div>
    ${data.history.length ? `<h2>Histórico de entregas e devoluções</h2>
    <table><thead><tr><th style="width:90px">Data</th><th style="width:80px">Tipo</th><th>Itens</th><th style="width:80px">Termo</th></tr></thead>
      <tbody>${historyRows}</tbody></table>` : ''}
    <div class="sigs"><div><div class="line"></div>Colaborador(a)</div><div><div class="line"></div>Conferido por</div></div>
  </body></html>`;
}

/** Excel: aba "Itens em posse" (uma linha por item) e, para um funcionário só, aba "Histórico" */
export async function exportEmployeeAssetsExcel(list: EmployeeAssets[], fileName: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GeniantisERP';
  wb.created = new Date();

  const header = (ws: import('exceljs').Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  };

  const ws = wb.addWorksheet('Itens em posse');
  ws.columns = [
    { header: 'Funcionário', key: 'name', width: 32 },
    { header: 'E-mail', key: 'email', width: 30 },
    { header: 'Departamento', key: 'dept', width: 16 },
    { header: 'Unidade', key: 'unit', width: 22 },
    { header: 'Situação do funcionário', key: 'status', width: 14 },
    { header: 'Patrimônio', key: 'pat', width: 12 },
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Categoria', key: 'cat', width: 18 },
    { header: 'Nº de série', key: 'serial', width: 18 },
    { header: 'Entregue em', key: 'date', width: 13, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Termo', key: 'term', width: 22 },
  ];
  for (const { employee: e, items } of list) {
    for (const i of items) {
      ws.addRow({
        name: e.full_name,
        email: e.email,
        dept: e.department,
        unit: e.unit,
        status: e.status === 'ativo' ? 'Ativo' : e.status === 'afastado' ? 'Afastado' : 'Desligado',
        pat: i.asset.patrimony,
        item: describe(i.asset),
        cat: categoryLabel(i.asset.category),
        serial: i.asset.serial_number || '',
        date: i.deliveredAt ? new Date(`${i.deliveredAt}T12:00:00`) : null,
        term: termLabel(i),
      });
    }
  }
  header(ws);

  if (list.length === 1) {
    const hs = wb.addWorksheet('Histórico');
    hs.columns = [
      { header: 'Data', key: 'date', width: 13, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Tipo', key: 'type', width: 12 },
      { header: 'Patrimônio', key: 'pat', width: 12 },
      { header: 'Item', key: 'item', width: 34 },
      { header: 'Termo', key: 'term', width: 12 },
      { header: 'Observações', key: 'notes', width: 40 },
    ];
    for (const m of list[0].history) {
      for (const i of m.items) {
        hs.addRow({
          date: new Date(`${m.movement_date}T12:00:00`),
          type: m.type === 'entrega' ? 'Entrega' : 'Devolução',
          pat: i.patrimony,
          item: i.description || '',
          term: m.term_status === 'assinado' ? 'Assinado' : 'Pendente',
          notes: m.notes || '',
        });
      }
    }
    header(hs);
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
