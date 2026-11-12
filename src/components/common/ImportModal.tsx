import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileDown, FileUp, Loader2, X } from 'lucide-react';
import { parseTable } from '../../lib/csv';
import { downloadImportTemplate, readSpreadsheet } from '../../lib/importSpreadsheet';
import { Importer, ImportError, PreparedRow } from '../../lib/importers/types';

interface Props {
  title: string;
  importer: Importer;
  onClose: () => void;
  /** Chamado ao fim da importação (para recarregar a lista) */
  onFinished: () => void;
}

type Step = 'select' | 'preview' | 'running' | 'done';

function friendlyError(error: any): string {
  const code = error?.code;
  if (code === '23505') return 'Já existe um cadastro com esse valor (duplicado).';
  if (code === 'PGRST116' || code === '42501') return 'Seu perfil não tem permissão para salvar.';
  return error?.message || 'Erro desconhecido.';
}

export const ImportModal: React.FC<Props> = ({ title, importer, onClose, onFinished }) => {
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<PreparedRow[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<ImportError[]>([]);
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => ({
    novo: rows.filter((r) => r.action === 'novo').length,
    atualizar: rows.filter((r) => r.action === 'atualizar').length,
  }), [rows]);

  const errorLines = useMemo(() => new Set(errors.map((e) => e.line)).size, [errors]);

  const handleFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setFileError('Selecione a planilha do modelo (.xlsx) ou um arquivo .csv.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('Arquivo muito grande (máximo 5 MB).');
      return;
    }
    try {
      const parsed = parseTable(await readSpreadsheet(file), importer.columns);
      if (parsed.error) { setFileError(parsed.error); return; }
      if (!parsed.rows.length) { setFileError('O arquivo não tem nenhuma linha preenchida abaixo do cabeçalho.'); return; }
      const result = importer.prepare(parsed.rows);
      setFileName(file.name);
      setRows(result.rows);
      setErrors(result.errors);
      setStep('preview');
    } catch (err: any) {
      setFileError(`Não foi possível ler o arquivo: ${err?.message || err}`);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const runImport = async () => {
    setStep('running');
    setProgress(0);
    const failed: ImportError[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      try {
        await rows[i].save();
      } catch (err) {
        failed.push({ line: rows[i].line, message: `${rows[i].label}: ${friendlyError(err)}` });
      }
      setProgress(i + 1);
    }
    setFailures(failed);
    setStep('done');
    onFinished();
  };

  const reset = () => {
    setStep('select');
    setRows([]);
    setErrors([]);
    setFailures([]);
    setFileName('');
  };

  const saved = rows.length - failures.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          {step !== 'running' && (
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {step === 'select' && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex-1 text-blue-900">
                <strong className="block">1. Baixe o modelo e preencha no Excel</strong>
                <span className="text-xs text-blue-700">Uma linha por cadastro. Colunas em vermelho (*) são obrigatórias; as de valores fixos têm lista de seleção.</span>
              </div>
              <button
                type="button"
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  try {
                    await downloadImportTemplate(importer.columns, importer.templateFileName);
                  } catch (err: any) {
                    setFileError(`Não foi possível gerar o modelo: ${err?.message || err}`);
                  } finally {
                    setDownloading(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-blue-200 hover:bg-blue-100 disabled:opacity-60 text-blue-700 rounded-lg text-sm font-semibold"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Baixar modelo Excel
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Coluna</th>
                      <th className="text-left px-3 py-2 font-semibold">Formato / valores</th>
                      <th className="text-left px-3 py-2 font-semibold">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importer.columns.map((c) => (
                      <tr key={c.key}>
                        <td className="px-3 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                          {c.header}{c.required && <span className="text-rose-600"> *</span>}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">{c.options?.length ? (c.options.length > 8 ? `Lista de seleção (${c.options.length} opções)` : `Lista: ${c.options.join(', ')}`) : c.hint || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-500 font-mono">{c.example || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
              {importer.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>

            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center">
              <strong className="block text-slate-800 mb-2">2. Envie o arquivo preenchido</strong>
              <input ref={inputRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              >
                <FileUp className="w-4 h-4" /> Escolher planilha
              </button>
              <span className="block text-[11px] text-slate-500 mt-2">Aceita o modelo .xlsx preenchido (ou .csv). Nada é gravado antes da prévia.</span>
            </div>

            {fileError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {fileError}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-slate-500">Arquivo: <strong className="text-slate-700">{fileName}</strong></p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="block text-2xl font-bold text-emerald-700">{counts.novo}</span>
                <span className="text-xs text-emerald-800">novos</span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <span className="block text-2xl font-bold text-blue-700">{counts.atualizar}</span>
                <span className="text-xs text-blue-800">para atualizar</span>
              </div>
              <div className={`p-3 rounded-xl border ${errorLines ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                <span className={`block text-2xl font-bold ${errorLines ? 'text-rose-700' : 'text-slate-400'}`}>{errorLines}</span>
                <span className={`text-xs ${errorLines ? 'text-rose-800' : 'text-slate-500'}`}>linhas com erro (ficam de fora)</span>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="border border-rose-200 rounded-xl">
                <div className="px-3 py-2 bg-rose-50 text-rose-800 text-xs font-semibold rounded-t-xl">
                  Corrija no arquivo e envie de novo, ou importe só as linhas certas.
                </div>
                <ul className="max-h-40 overflow-y-auto divide-y divide-rose-100 text-xs">
                  {errors.map((e, i) => (
                    <li key={i} className="px-3 py-1.5 text-slate-700"><strong className="text-rose-700">Linha {e.line}:</strong> {e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {rows.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold w-14">Linha</th>
                        <th className="text-left px-3 py-2 font-semibold">Cadastro</th>
                        <th className="text-left px-3 py-2 font-semibold">Detalhe</th>
                        <th className="text-right px-3 py-2 font-semibold">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r) => (
                        <tr key={r.line}>
                          <td className="px-3 py-1.5 text-slate-400">{r.line}</td>
                          <td className="px-3 py-1.5 font-semibold text-slate-800">{r.label}</td>
                          <td className="px-3 py-1.5 text-slate-500">{r.detail}</td>
                          <td className="px-3 py-1.5 text-right">
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${r.action === 'novo' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                              {r.action === 'novo' ? 'Novo' : 'Atualizar'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={reset} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Escolher outro arquivo</button>
              <button
                type="button"
                disabled={!rows.length}
                onClick={runImport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold"
              >
                Importar {rows.length} {importer.entityPlural}
              </button>
            </div>
          </div>
        )}

        {step === 'running' && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-700">Importando {progress} de {rows.length}…</p>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden max-w-sm mx-auto">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${rows.length ? (progress / rows.length) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-slate-500">Não feche esta janela.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-sm">
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${failures.length ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              {failures.length
                ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
              <div>
                <strong className="block text-slate-800">{saved} de {rows.length} {importer.entityPlural} importados.</strong>
                {failures.length > 0 && <span className="text-xs text-amber-800">{failures.length} não foram gravados — veja o motivo abaixo.</span>}
                {errors.length > 0 && <span className="block text-xs text-slate-600">{errorLines} linhas do arquivo ficaram de fora por erro de preenchimento.</span>}
              </div>
            </div>
            {failures.length > 0 && (
              <ul className="max-h-48 overflow-y-auto border border-amber-200 rounded-xl divide-y divide-amber-100 text-xs">
                {failures.map((f, i) => (
                  <li key={i} className="px-3 py-1.5 text-slate-700"><strong className="text-amber-700">Linha {f.line}:</strong> {f.message}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={reset} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Importar outro arquivo</button>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">Concluir</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
