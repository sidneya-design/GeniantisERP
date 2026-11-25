import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Copy, Megaphone, Palette, Plus, Printer, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { usePermission } from '../lib/usePermission';
import {
  Banner, BannerStyle, blankBanner, DEFAULT_BANNER, DEFAULT_STYLE, deleteBanner, listBanners, printBanner, renderBannerHtml, saveBanner, styleOf,
} from '../lib/bannerTemplate';
import { A4Preview as SharedA4Preview } from '../components/common/A4Preview';

const A4Preview: React.FC<{ html: string }> = ({ html }) => <SharedA4Preview html={html} title="Prévia do banner" />;

const COLOR_FIELDS: { key: keyof BannerStyle; label: string }[] = [
  { key: 'primary', label: 'Cor principal (topo e bordas)' },
  { key: 'headerText', label: 'Textos do topo' },
  { key: 'cardTitle', label: 'Títulos dos blocos' },
  { key: 'cardText', label: 'Textos dos blocos' },
];

const SIZE_FIELDS: { key: keyof BannerStyle; label: string; min: number; max: number }[] = [
  { key: 'titleSize', label: 'Título', min: 14, max: 44 },
  { key: 'subtitleSize', label: 'Subtítulo', min: 8, max: 24 },
  { key: 'introSize', label: 'Texto de abertura', min: 7, max: 18 },
  { key: 'cardTitleSize', label: 'Títulos dos blocos', min: 8, max: 24 },
  { key: 'cardTextSize', label: 'Textos dos blocos', min: 7, max: 18 },
];

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white';
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-1';

type Feedback = { type: 'success' | 'error'; text: string } | null;

export const Banners: React.FC = () => {
  const { canEdit, canDelete } = usePermission('banners');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState<Banner>({ ...DEFAULT_BANNER, cards: DEFAULT_BANNER.cards.map((c) => ({ ...c })) });
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const flash = (f: Feedback) => {
    setFeedback(f);
    if (f?.type === 'success') setTimeout(() => setFeedback(null), 3500);
  };

  const load = async (selectId?: string) => {
    setLoading(true);
    try {
      const list = await listBanners();
      setBanners(list);
      const pick = list.find((b) => b.id === selectId) || (selectId === undefined ? list[0] : undefined);
      if (pick) { setCurrent(pick); setDirty(false); }
    } catch (e: any) {
      flash({ type: 'error', text: e?.message || 'Não foi possível carregar os banners.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const preview = useMemo(() => renderBannerHtml(current), [current]);

  const update = (patch: Partial<Banner>) => { setCurrent((b) => ({ ...b, ...patch })); setDirty(true); };
  const style = styleOf(current);
  const updateStyle = (patch: Partial<BannerStyle>) => update({ style: { ...(current.style || {}), ...patch } });
  const updateCard = (i: number, patch: Partial<Banner['cards'][number]>) =>
    update({ cards: current.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const moveCard = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= current.cards.length) return;
    const cards = [...current.cards];
    [cards[i], cards[j]] = [cards[j], cards[i]];
    update({ cards });
  };

  const confirmDiscard = () => !dirty || window.confirm('Há alterações não salvas neste banner. Descartar?');

  const select = (b: Banner) => { if (confirmDiscard()) { setCurrent(b); setDirty(false); } };
  const startNew = (fromDefault: boolean) => {
    if (!confirmDiscard()) return;
    const base = fromDefault ? DEFAULT_BANNER : blankBanner();
    setCurrent({ ...base, id: undefined, cards: base.cards.map((c) => ({ ...c })) });
    setDirty(true);
  };
  const duplicate = () => {
    setCurrent({ ...current, id: undefined, name: `${current.name} (cópia)`, cards: current.cards.map((c) => ({ ...c })) });
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveBanner(current);
      await load(saved.id);
      flash({ type: 'success', text: 'Banner salvo.' });
    } catch (e: any) {
      flash({ type: 'error', text: e?.message || 'Não foi possível salvar.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!current.id || !window.confirm(`Excluir o banner "${current.name}"?`)) return;
    try {
      await deleteBanner(current.id);
      setDirty(false);
      await load();
      flash({ type: 'success', text: 'Banner excluído.' });
    } catch (e: any) {
      flash({ type: 'error', text: e?.message || 'Não foi possível excluir.' });
    }
  };

  const print = () => {
    if (!printBanner(current)) flash({ type: 'error', text: 'Não foi possível abrir a impressão. Verifique o bloqueador de pop-ups.' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Banners & Avisos</h2>
          <p className="text-slate-500 text-sm mt-1">Banners A4 para o mural: edite os textos, confira a prévia e imprima.</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
          {canEdit && <button type="button" onClick={() => startNew(false)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> Em branco</button>}
          {canEdit && <button type="button" onClick={() => startNew(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> Calendário de fim de ano</button>}
          <button type="button" onClick={print} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm"><Printer className="w-4 h-4" /> Imprimir</button>
        </div>
      </div>

      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 border ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />}
          <span className="flex-1">{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Lista compacta em telas menores */}
      <div className="2xl:hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase shrink-0">Banner</span>
        <select
          value={current.id || ''}
          onChange={(e) => { const b = banners.find((x) => x.id === e.target.value); if (b) select(b); }}
          className={inputClass}
          disabled={loading}
        >
          {!current.id && <option value="">{current.name} (não salvo)</option>}
          {banners.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
        {/* Lista */}
        <div className="hidden 2xl:block bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-1">
          <span className="block text-xs font-bold text-slate-500 uppercase px-2 py-1">Banners salvos</span>
          {loading && <p className="text-xs text-slate-400 px-2 py-2">Carregando…</p>}
          {!loading && banners.length === 0 && <p className="text-xs text-slate-400 px-2 py-2">Nenhum banner salvo ainda.</p>}
          {banners.map((b) => (
            <button key={b.id} type="button" onClick={() => select(b)} className={`w-full text-left px-2.5 py-2 rounded-lg text-sm ${b.id === current.id ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>
              <span className="block truncate">{b.name}</span>
              {b.updated_at && <span className="block text-[11px] text-slate-400">{new Date(b.updated_at).toLocaleDateString('pt-BR')}</span>}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 text-sm">
          <div className="flex items-center gap-2 text-slate-800 font-bold"><Megaphone className="w-5 h-5 text-blue-600" /> {current.id ? 'Editar banner' : 'Novo banner'}{dirty && <span className="text-[11px] font-semibold text-amber-600">• não salvo</span>}</div>
          <fieldset disabled={!canEdit} className="space-y-4">
            <div><label className={labelClass}>Nome (só para a lista)</label><input value={current.name} onChange={(e) => update({ name: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Título</label><input value={current.title} onChange={(e) => update({ title: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Subtítulo</label><input value={current.subtitle} onChange={(e) => update({ subtitle: e.target.value })} className={inputClass} placeholder="Ex.: Olá, Geniantes!" /></div>
            <div><label className={labelClass}>Texto de abertura</label><textarea rows={2} value={current.intro} onChange={(e) => update({ intro: e.target.value })} className={inputClass} /></div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Blocos ({current.cards.length})</span>
              <button type="button" onClick={() => update({ cards: [...current.cards, { title: '', text: '' }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"><Plus className="w-3.5 h-3.5" /> Adicionar bloco</button>
            </div>
            {current.cards.length > 6 && <p className="text-[11px] text-amber-700">Com mais de 6 blocos o conteúdo pode não caber na folha. Confira a prévia.</p>}
            {current.cards.map((c, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <input value={c.title} onChange={(e) => updateCard(i, { title: e.target.value })} placeholder="Título do bloco" className={`${inputClass} font-semibold`} />
                  <button type="button" onClick={() => moveCard(i, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Subir"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => moveCard(i, 1)} disabled={i === current.cards.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Descer"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => update({ cards: current.cards.filter((_, j) => j !== i) })} className="p-1.5 text-slate-400 hover:text-rose-600" title="Remover"><Trash2 className="w-4 h-4" /></button>
                </div>
                <textarea rows={2} value={c.text} onChange={(e) => updateCard(i, { text: e.target.value })} placeholder="Uma informação por linha" className={inputClass} />
              </div>
            ))}

            <div className="border-t border-slate-100 pt-3"><label className={labelClass}>Rodapé (opcional)</label><textarea rows={2} value={current.footer} onChange={(e) => update({ footer: e.target.value })} className={inputClass} placeholder="Ex.: Dúvidas? Fale com o RH." /></div>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={current.show_logo} onChange={(e) => update({ show_logo: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-xs font-semibold text-slate-700">Mostrar logo da Geniantis</span></label>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase"><Palette className="w-4 h-4" /> Cores e tamanhos</span>
                <button type="button" onClick={() => update({ style: {} })} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {COLOR_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1">{f.label}</span>
                    <span className="flex items-center gap-2">
                      <input type="color" value={String(style[f.key])} onChange={(e) => updateStyle({ [f.key]: e.target.value.toUpperCase() })} className="h-9 w-11 shrink-0 rounded border border-slate-300 bg-white p-0.5 cursor-pointer" />
                      <input value={String(style[f.key])} onChange={(e) => updateStyle({ [f.key]: e.target.value })} maxLength={7} className={`${inputClass} font-mono uppercase`} />
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SIZE_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1">{f.label}</span>
                    <span className="flex items-center gap-1.5">
                      <input type="number" min={f.min} max={f.max} step={0.5} value={Number(style[f.key])} onChange={(e) => updateStyle({ [f.key]: e.target.value === '' ? DEFAULT_STYLE[f.key] : Number(e.target.value) })} className={inputClass} />
                      <span className="text-xs text-slate-400">pt</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>

          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            {canDelete && current.id && <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-semibold"><Trash2 className="w-4 h-4" /> Excluir</button>}
            {canEdit && current.id && <button type="button" onClick={duplicate} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm"><Copy className="w-4 h-4" /> Duplicar</button>}
            {canEdit && <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold"><Save className="w-4 h-4" /> {busy ? 'Salvando…' : 'Salvar'}</button>}
          </div>
        </div>

        {/* Prévia A4 */}
        <div className="bg-slate-100 rounded-2xl border border-slate-200 p-3 sm:p-4 lg:sticky lg:top-4">
          <span className="block text-xs font-bold text-slate-500 uppercase mb-2">Prévia (A4)</span>
          <A4Preview html={preview} />
        </div>
      </div>
    </div>
  );
};
