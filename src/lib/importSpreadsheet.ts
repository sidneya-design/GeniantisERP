// Modelo Excel (.xlsx) com listas de seleção para importação em lote, e leitura
// da planilha preenchida (.xlsx ou .csv). O exceljs só é baixado quando usado.
import { csvToTable, ImportColumn, readCsvFile } from './csv';

const MAX_ROWS = 1000;
const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E3A8A' } };
const REQUIRED_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFB91C1C' } };

function columnLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Baixa o modelo: aba "Cadastro" (cabeçalho + linhas com lista de seleção nas
 * colunas de valores fixos) e aba oculta "Listas" com os valores aceitos.
 */
export async function downloadImportTemplate(columns: ImportColumn[], fileName: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GeniantisERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Cadastro', { views: [{ state: 'frozen', ySplit: 1 }] });
  const lists = wb.addWorksheet('Listas', { state: 'hidden' });

  ws.columns = columns.map((c) => ({
    header: c.required ? `${c.header} *` : c.header,
    key: c.key,
    width: Math.max(16, Math.min(40, c.header.length + 6, (c.example?.length || 0) + 6)),
  }));

  const header = ws.getRow(1);
  header.height = 22;
  header.alignment = { vertical: 'middle' };
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = c.required ? REQUIRED_FILL : HEADER_FILL;
    const notes = [c.required ? 'Obrigatório.' : 'Opcional.', c.hint, c.example ? `Exemplo: ${c.example}` : '']
      .filter(Boolean)
      .join('\n');
    cell.note = notes;
  });

  let listCol = 0;
  columns.forEach((c, i) => {
    const letter = columnLetter(i);
    if (c.options?.length) {
      const lc = columnLetter(listCol);
      lists.getCell(`${lc}1`).value = c.header;
      c.options.forEach((opt, j) => { lists.getCell(`${lc}${j + 2}`).value = opt; });
      const ref = `Listas!$${lc}$2:$${lc}$${c.options.length + 1}`;
      listCol += 1;
      for (let r = 2; r <= MAX_ROWS + 1; r += 1) {
        ws.getCell(`${letter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [ref],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Valor não permitido',
          error: `Escolha um valor da lista de ${c.header}.`,
        };
      }
    } else if (c.kind === 'date') {
      for (let r = 2; r <= MAX_ROWS + 1; r += 1) {
        const cell = ws.getCell(`${letter}${r}`);
        cell.numFmt = 'dd/mm/yyyy';
        cell.dataValidation = {
          type: 'date',
          operator: 'between',
          allowBlank: true,
          formulae: [new Date(1900, 0, 2), new Date(2100, 11, 31)],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Data inválida',
          error: 'Digite a data no formato DD/MM/AAAA.',
        };
      }
    } else if (c.kind === 'money') {
      for (let r = 2; r <= MAX_ROWS + 1; r += 1) {
        const cell = ws.getCell(`${letter}${r}`);
        cell.numFmt = '"R$" #,##0.00';
        cell.dataValidation = {
          type: 'decimal',
          operator: 'greaterThanOrEqual',
          allowBlank: true,
          formulae: [0],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Valor inválido',
          error: 'Digite só o número, ex.: 4599,90.',
        };
      }
    } else {
      // Texto: evita o Excel transformar CPF/telefone em número
      for (let r = 2; r <= MAX_ROWS + 1; r += 1) ws.getCell(`${letter}${r}`).numFmt = '@';
    }
  });

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

const pad = (n: number) => String(n).padStart(2, '0');

/** Valor de célula do exceljs → texto (datas em DD/MM/AAAA, números com vírgula) */
function cellToText(value: any): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // Datas do Excel chegam como meia-noite UTC
    return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`;
  }
  if (typeof value === 'number') return String(value).replace('.', ',');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') {
    if ('result' in value) return cellToText(value.result);
    if ('text' in value) return cellToText(value.text);
    if (Array.isArray(value.richText)) return value.richText.map((t: any) => t.text).join('');
    if ('hyperlink' in value) return String(value.hyperlink).replace(/^mailto:/i, '');
    return '';
  }
  return String(value);
}

/** Lê o arquivo enviado (.xlsx ou .csv) como tabela; a 1ª linha é o cabeçalho */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) return csvToTable(await readCsvFile(file));

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet('Cadastro') || wb.worksheets.find((w) => w.state !== 'hidden') || wb.worksheets[0];
  if (!ws) return [];

  const width = ws.getRow(1).cellCount;
  const table: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= width; c += 1) cells.push(cellToText(row.getCell(c).value).trim());
    table.push(cells);
  }
  return table;
}
