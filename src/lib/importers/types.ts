import { CsvRow, ImportColumn } from '../csv';

export interface ImportError {
  line: number;
  message: string;
}

export interface PreparedRow {
  line: number;
  /** Como a linha aparece na prévia (ex.: nome do funcionário, patrimônio) */
  label: string;
  detail?: string;
  action: 'novo' | 'atualizar';
  save: () => Promise<void>;
}

export interface Importer {
  /** Ex.: "funcionários" */
  entityPlural: string;
  templateFileName: string;
  columns: ImportColumn[];
  /** Regras e observações mostradas antes de escolher o arquivo */
  notes: string[];
  prepare: (rows: CsvRow[]) => { rows: PreparedRow[]; errors: ImportError[] };
}
