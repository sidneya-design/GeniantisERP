// Leitura de CSV e conversão de valores para importação em lote (padrão do Excel
// em português: separador ";" e datas DD/MM/AAAA). Aceita também separador ",".

export interface ImportColumn {
  key: string;
  header: string;
  required?: boolean;
  /** Formato ou valores aceitos, mostrado na tela de importação */
  hint?: string;
  example?: string;
  /** Valores aceitos: viram lista de seleção no modelo Excel */
  options?: string[];
  /** Formato da coluna no modelo Excel */
  kind?: 'date' | 'money';
}

export interface CsvRow {
  /** Linha no arquivo (cabeçalho = 1), para apontar erros */
  line: number;
  values: Record<string, string>;
}

/** Remove acentos, "*", texto entre parênteses e espaços extras, para comparar cabeçalhos */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Lê o arquivo como UTF-8; se não for (CSV comum do Excel), usa Windows-1252 */
export async function readCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Texto do CSV → tabela (detecta separador ";" ou ",") */
export function csvToTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  return splitCsv(clean, delimiter);
}

export function parseCsv(text: string, columns: ImportColumn[]): { rows: CsvRow[]; error?: string } {
  return parseTable(csvToTable(text), columns);
}

/**
 * Converte a tabela (1ª linha = cabeçalho) em linhas com as chaves das colunas.
 * Cabeçalhos desconhecidos são ignorados; faltando um obrigatório, retorna erro.
 */
export function parseTable(table: string[][], columns: ImportColumn[]): { rows: CsvRow[]; error?: string } {
  if (!table.length) return { rows: [], error: 'O arquivo está vazio.' };

  const byHeader = new Map(columns.map((c) => [normalizeText(c.header), c.key]));
  const keys = table[0].map((h) => byHeader.get(normalizeText(h)) || null);

  const missing = columns.filter((c) => c.required && !keys.includes(c.key));
  if (missing.length) {
    return {
      rows: [],
      error: `Faltam colunas no cabeçalho: ${missing.map((c) => c.header).join(', ')}. Use o modelo para conferir os nomes.`,
    };
  }

  const rows: CsvRow[] = [];
  table.slice(1).forEach((cells, index) => {
    if (cells.every((c) => !c.trim())) return;
    const values: Record<string, string> = {};
    keys.forEach((key, col) => {
      if (key) values[key] = (cells[col] || '').trim();
    });
    rows.push({ line: index + 2, values });
  });
  return { rows };
}

/** DD/MM/AAAA ou AAAA-MM-DD → AAAA-MM-DD. Vazio → null. Inválida → undefined */
export function parseDate(value: string): string | null | undefined {
  const v = value.trim();
  if (!v) return null;
  let y: number;
  let m: number;
  let d: number;
  let match = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return undefined;
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  if (y < 1900 || y > 2100) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "R$ 1.234,56", "1234,56" ou "1234.56" → 1234.56. Vazio → null. Inválido → undefined */
export function parseMoney(value: string): number | null | undefined {
  let v = value.replace(/R\$/i, '').replace(/\s/g, '');
  if (!v) return null;
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

/** Procura o valor em uma lista de opções aceitando o código ou o nome (sem acento) */
export function matchOption<T extends string>(value: string, options: { value: T; labels: string[] }[]): T | undefined {
  const v = normalizeText(value);
  return options.find((o) => normalizeText(o.value) === v || o.labels.some((l) => normalizeText(l) === v))?.value;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
