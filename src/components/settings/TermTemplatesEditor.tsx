import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, RotateCcw, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  DEFAULT_TEMPLATES,
  PLACEHOLDERS,
  SAMPLE_DATA,
  TERM_LABEL,
  TermTemplate,
  TermTemplateId,
  loadTermTemplates,
  renderTermHtml,
  resetTermTemplate,
  saveTermTemplate,
} from '../../lib/termTemplate';

const IDS: TermTemplateId[] = ['termo_entrega', 'termo_devolucao'];

const same = (a: TermTemplate, b: TermTemplate) =>
  a.title === b.title && a.body === b.body && a.signatures === b.signatures && (a.footer || '') === (b.footer || '') && a.show_logo === b.show_logo;

/** Configurações › Modelos de termo: edição do texto dos termos de entrega e devolução */
export const TermTemplatesEditor: React.FC = () => {
  const { user } = useAuth();
  const [active, setActive] = useState<TermTemplateId>('termo_entrega');
  const [saved, setSaved] = useState<Record<TermTemplateId, TermTemplate> | null>(null);
  const [drafts, setDrafts] = useState<Record<TermTemplateId, TermTemplate> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadTermTemplates().then((t) => { setSaved(t); setDrafts(t); });
  }, []);

  const draft = drafts?.[active];
  const isDirty = !!(draft && saved && !same(draft, saved[active]));
  const isCustom = !!(saved && !same(saved[active], DEFAULT_TEMPLATES[active]));

  const previewHtml = useMemo(
    () => (draft ? renderTermHtml(draft, { ...SAMPLE_DATA, type: active === 'termo_entrega' ? 'entrega' : 'devolucao' }) : ''),
    [draft, active],
  );

  if (!drafts || !draft || !saved) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando modelos de termo…
      </div>
    );
  }

  const update = (patch: Partial<TermTemplate>) => {
    setMessage(null);
    setDrafts({ ...drafts, [active]: { ...draft, ...patch } });
  };

  const insertPlaceholder = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) { update({ body: `${draft.body}${token}` }); return; }
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? start;
    const insert = key === 'ativos' ? `\n\n${token}\n\n` : token;
    update({ body: draft.body.slice(0, start) + insert + draft.body.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + insert.length;
    });
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await saveTermTemplate(draft, user?.id);
      setSaved({ ...saved, [active]: draft });
      setMessage({ ok: true, text: `${TERM_LABEL[active]} salvo. Os próximos termos impressos já usam este texto.` });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || 'Não foi possível salvar o modelo.' });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Voltar o ${TERM_LABEL[active].toLowerCase()} para o texto padrão? O texto personalizado será apagado.`)) return;
    setBusy(true);
    try {
      await resetTermTemplate(active);
      const def = DEFAULT_TEMPLATES[active];
      setSaved({ ...saved, [active]: def });
      setDrafts({ ...drafts, [active]: def });
      setMessage({ ok: true, text: 'Modelo voltou ao texto padrão.' });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || 'Não foi possível restaurar o padrão.' });
    } finally {
      setBusy(false);
    }
  };

  const openPrintPreview = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(previewHtml);
    w.document.close();
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 border-slate-100">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
          <FileText className="w-5 h-5 text-blue-600" />
          Modelos de termo
        </h3>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => { setActive(id); setMessage(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${active === id ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              {TERM_LABEL[id]}
              {drafts && saved && !same(drafts[id], saved[id]) && <span className="ml-1 text-amber-600">•</span>}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Texto usado em <strong>Entregas &amp; Devoluções › Imprimir termo / Ver termo</strong>.{' '}
        {isCustom ? 'Este modelo está personalizado.' : 'Este modelo está com o texto padrão.'}
      </p>

      {message && (
        <div className={`px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 border ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {message.ok && <CheckCircle2 className="w-4 h-4 shrink-0" />} {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4 text-sm">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-700 mb-1">Título</span>
            <input
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1">Inserir informação no texto</span>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => insertPlaceholder(p.key)}
                  title={`{{${p.key}}}`}
                  className="px-2 py-1 text-[11px] font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-slate-700 mb-1">Texto do termo</span>
            <textarea
              ref={bodyRef}
              rows={16}
              value={draft.body}
              onChange={(e) => update({ body: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono leading-relaxed focus:ring-2 focus:ring-blue-600"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Linha em branco separa parágrafos. <code>**texto**</code> deixa em negrito, <code>## </code> no começo vira subtítulo
              e <code>[centro]</code> no começo centraliza o parágrafo. Use <code>____</code> para espaços de preenchimento à mão.
              A tabela de ativos entra onde estiver <code>{'{{ativos}}'}</code>, sozinha no parágrafo (apague para não mostrar).
            </span>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-slate-700 mb-1">Assinaturas (uma por linha: o texto que vai embaixo da linha)</span>
            <textarea
              rows={3}
              value={draft.signatures}
              onChange={(e) => update({ signatures: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-slate-700 mb-1">Rodapé</span>
            <input
              value={draft.footer || ''}
              onChange={(e) => update({ footer: e.target.value })}
              placeholder="Vazio = sem rodapé"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={draft.show_logo} onChange={(e) => update({ show_logo: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
            <span className="text-xs font-semibold text-slate-700">Mostrar o logo no topo</span>
          </label>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={busy || !isDirty}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar modelo
            </button>
            {isDirty && (
              <button type="button" onClick={() => update(saved[active])} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
                Descartar alterações
              </button>
            )}
            {isCustom && (
              <button
                type="button"
                disabled={busy}
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm ml-auto"
              >
                <RotateCcw className="w-4 h-4" /> Restaurar padrão
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Prévia (com dados de exemplo)</span>
            <button type="button" onClick={openPrintPreview} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              Abrir em tela cheia
            </button>
          </div>
          <iframe
            title="Prévia do termo"
            srcDoc={previewHtml}
            sandbox="allow-same-origin"
            className="w-full h-[640px] border border-slate-200 rounded-xl bg-white"
          />
        </div>
      </div>
    </div>
  );
};
