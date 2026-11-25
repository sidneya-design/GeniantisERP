import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Globe, Lock, Loader2, LogOut, Pipette, Trash2, UserPlus, X } from 'lucide-react';
import {
  AgendaCalendar, AgendaService, AgendaUser, CalendarMember, ColorLabel, colorHex, isHex, PRESET_COLORS, SHARE_LEVEL_LABEL, textOn,
} from '../../services/agendaService';

export const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-base sm:text-sm bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600';

export const userLabel = (u: AgendaUser | undefined) => u?.full_name || u?.email || 'Usuário';

// ---------------- Janela (vira folha de baixo no celular) ----------------

export const Sheet: React.FC<{ onClose: () => void; children: React.ReactNode; wide?: boolean; label: string }> = ({ onClose, children, wide, label }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={label} className={`bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`}>
        {children}
      </div>
    </div>
  );
};

// ---------------- Cores ----------------

const CUSTOM_KEY = 'geniantis_agenda_cores';

function readCustom(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    return Array.isArray(list) ? list.filter(isHex) : [];
  } catch {
    return [];
  }
}
function writeCustom(list: string[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    // ignora (navegação privada)
  }
}

const Swatch: React.FC<{ hex: string; selected: boolean; label: string; onClick: () => void; onRemove?: () => void }> = ({ hex, selected, label, onClick, onRemove }) => (
  <span className="relative group">
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-7 h-7 rounded-full flex items-center justify-center ${selected ? 'ring-2 ring-offset-2 ring-slate-700' : ''}`}
      style={{ backgroundColor: hex }}
    >
      {selected && <Check className="w-4 h-4" style={{ color: textOn(hex) }} />}
    </button>
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-500 hidden group-hover:flex items-center justify-center"
        aria-label={`Remover ${label} de Minhas cores`}
      >
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
);

/**
 * Paleta pronta + "Minhas cores" (guardadas neste navegador) + campo para adicionar qualquer cor.
 * inherit: mostra a opção "Cor da agenda" (valor nulo).
 */
export const ColorPicker: React.FC<{
  value: string | null;
  onChange: (c: string | null) => void;
  /** Escolheu uma cor pronta (fecha o menu) */
  onDone?: () => void;
  inherit?: { hex: string };
  /** Cores já usadas nas agendas, para reaproveitar */
  suggestions?: string[];
  /** Etiquetas de cor (ex.: ADM = verde): aparecem primeiro, com o nome */
  labels?: ColorLabel[];
}> = ({ value, onChange, onDone, inherit, suggestions = [], labels = [] }) => {
  const [custom, setCustom] = useState<string[]>(readCustom);
  const presetHexes = PRESET_COLORS.map((p) => p.hex);
  const mine = useMemo(
    () => [...new Set([...custom, ...suggestions.filter(isHex).map((c) => c.toLowerCase())])].filter((c) => !presetHexes.includes(c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [custom, suggestions.join()]
  );
  const current = value === null ? null : colorHex(value);

  // Seletor de cor personalizada (aberto pela setinha). A cor só entra em Minhas cores
  // quando a pessoa clica em "Adicionar".
  const [customOpen, setCustomOpen] = useState(false);
  const [before, setBefore] = useState<string | null>(value);

  const add = (hex: string) => {
    if (!isHex(hex)) return;
    const h = hex.toLowerCase();
    if (!presetHexes.includes(h) && !custom.includes(h)) {
      const next = [h, ...custom].slice(0, 16);
      setCustom(next);
      writeCustom(next);
    }
    onChange(h);
  };
  const removeCustom = (hex: string) => {
    const next = custom.filter((c) => c !== hex);
    setCustom(next);
    writeCustom(next);
  };

  return (
    <div className="space-y-2.5" role="radiogroup" aria-label="Cor">
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l) => (
            <button
              key={l.color}
              type="button"
              role="radio"
              aria-checked={current === l.color}
              onClick={() => { onChange(l.color); onDone?.(); }}
              className={`h-7 pl-1 pr-2.5 rounded-full border text-xs font-semibold text-slate-700 flex items-center gap-1.5 ${current === l.color ? 'border-slate-700 ring-1 ring-slate-700' : 'border-slate-300 hover:bg-slate-50'}`}
            >
              <span className="w-5 h-5 rounded-full" style={{ backgroundColor: l.color }} /> {l.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {inherit && (
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            onClick={() => { onChange(null); onDone?.(); }}
            className={`h-7 pl-1 pr-2.5 rounded-full border text-xs font-semibold text-slate-600 flex items-center gap-1.5 ${value === null ? 'border-slate-700 ring-1 ring-slate-700' : 'border-slate-300'}`}
          >
            <span className="w-5 h-5 rounded-full" style={{ backgroundColor: inherit.hex }} /> Cor da agenda
          </button>
        )}
        {PRESET_COLORS.map((p) => (
          <Swatch key={p.key} hex={p.hex} label={labels.find((l) => l.color === p.hex)?.name || p.label} selected={current === p.hex} onClick={() => { onChange(p.key); onDone?.(); }} />
        ))}
        <button
          type="button"
          onClick={() => { if (!customOpen) setBefore(value); setCustomOpen((v) => !v); }}
          className={`w-7 h-7 rounded-full border flex items-center justify-center text-slate-600 hover:bg-slate-100 ${customOpen ? 'border-slate-600 bg-slate-100' : 'border-slate-300'}`}
          title="Cor personalizada"
          aria-label="Cor personalizada"
          aria-expanded={customOpen}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${customOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {mine.length > 0 && (
        <div>
          <span className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Minhas cores</span>
          <div className="flex flex-wrap items-center gap-2">
            {mine.map((hex) => (
              <Swatch key={hex} hex={hex} label={labels.find((l) => l.color === hex)?.name || hex} selected={current === hex} onClick={() => { onChange(hex); onDone?.(); }} onRemove={custom.includes(hex) ? () => removeCustom(hex) : undefined} />
            ))}
          </div>
        </div>
      )}
      {customOpen && (
        <CustomColor
          initial={current || '#2563eb'}
          // Enquanto ajusta, a cor já aparece no evento/agenda (sem guardar)
          onPreview={(hex) => onChange(hex)}
          onAdd={(hex) => { add(hex); setCustomOpen(false); onDone?.(); }}
          onCancel={() => { onChange(before); setCustomOpen(false); }}
        />
      )}
    </div>
  );
};

// ---------------- Seletor de cor personalizada ----------------

type HSV = { h: number; s: number; v: number };

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
const hsvToRgb = ({ h, s, v }: HSV) => {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 };
};
const rgbToHsv = (r: number, g: number, b: number): HSV => {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  let h = 0;
  if (d) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
};
const hsvToHex = (c: HSV) => {
  const { r, g, b } = hsvToRgb(c);
  return rgbToHex(r, g, b);
};

/** Quadro de cor + matiz + conta-gotas + RGB/código, com o botão de adicionar */
const CustomColor: React.FC<{
  initial: string;
  onPreview: (hex: string) => void;
  onAdd: (hex: string) => void;
  onCancel: () => void;
}> = ({ initial, onPreview, onAdd, onCancel }) => {
  const [hsv, setHsv] = useState<HSV>(() => {
    const { r, g, b } = hexToRgb(isHex(initial) ? initial : '#2563eb');
    return rgbToHsv(r, g, b);
  });
  const hex = hsvToHex(hsv);
  const rgb = hexToRgb(hex);
  const [hexText, setHexText] = useState(hex);
  useEffect(() => setHexText(hex), [hex]);
  useEffect(() => onPreview(hex), [hex]); // eslint-disable-line react-hooks/exhaustive-deps

  const boxRef = useRef<HTMLDivElement>(null);
  const pick = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setHsv((c) => ({ ...c, s, v }));
  };
  const setRgb = (k: 'r' | 'g' | 'b', val: string) => {
    const n = Math.max(0, Math.min(255, Number(val) || 0));
    const next = { ...rgb, [k]: n };
    setHsv(rgbToHsv(next.r, next.g, next.b));
  };
  const setFromHex = (t: string) => {
    const v = t.startsWith('#') ? t : `#${t}`;
    setHexText(v);
    if (isHex(v)) {
      const { r, g, b } = hexToRgb(v);
      setHsv(rgbToHsv(r, g, b));
    }
  };
  const eyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const sample = async () => {
    try {
      const res = await new (window as any).EyeDropper().open();
      if (res?.sRGBHex) setFromHex(res.sRGBHex);
    } catch {
      // cancelado
    }
  };

  return (
    <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
      <div
        ref={boxRef}
        className="relative h-36 cursor-crosshair touch-none select-none"
        style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={(e) => { if (e.buttons) pick(e); }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, rgba(255,255,255,0))' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #000, rgba(0,0,0,0))' }} />
        <span
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow ring-1 ring-black/30 pointer-events-none"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }}
        />
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-3">
          {eyeDropper && (
            <button type="button" onClick={sample} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Pegar uma cor da tela" aria-label="Pegar uma cor da tela">
              <Pipette className="w-4 h-4" />
            </button>
          )}
          <span className="w-8 h-8 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: hex }} />
          <input
            type="range"
            min={0}
            max={359}
            value={Math.round(hsv.h)}
            onChange={(e) => setHsv((c) => ({ ...c, h: Number(e.target.value) }))}
            className="flex-1 h-3 rounded-full appearance-none cursor-pointer"
            style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
            aria-label="Matiz"
          />
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <input value={hexText} onChange={(e) => setFromHex(e.target.value)} maxLength={7} className="col-span-1 px-1 py-1.5 border border-slate-300 rounded-md text-xs font-mono text-center self-start" aria-label="Código da cor" />
          {(['r', 'g', 'b'] as const).map((k) => (
            <label key={k} className="col-span-1 text-[10px] font-semibold uppercase text-slate-400">
              <input type="number" min={0} max={255} value={rgb[k]} onChange={(e) => setRgb(k, e.target.value)} className="w-full px-1 py-1.5 border border-slate-300 rounded-md text-xs text-center text-slate-800" aria-label={k.toUpperCase()} />
              {k}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button type="button" onClick={() => onAdd(hex)} className="inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
            Adicionar cor <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------- Etiquetas de cor ----------------

/** Dá nome às cores (ex.: ADM = verde, Fin = azul). Cada pessoa tem as suas. */
export const ColorLabelsEditor: React.FC<{
  labels: ColorLabel[];
  canEdit: boolean;
  /** Abre já editando a etiqueta desta cor */
  initialEdit?: string;
  onClose: () => void;
  onChanged: () => void;
}> = ({ labels, canEdit, initialEdit, onClose, onChanged }) => {
  const [editing, setEditing] = useState<{ previous?: string; name: string; color: string } | null>(() => {
    const l = initialEdit ? labels.find((x) => x.color === initialEdit) : undefined;
    return l && canEdit ? { previous: l.color, name: l.name, color: l.color } : null;
  });
  const [recolor, setRecolor] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) { setError('Dê um nome à etiqueta.'); return; }
    const hex = colorHex(editing.color);
    const other = labels.find((l) => l.color === hex && l.color !== editing.previous);
    if (other) { setError(`Essa cor já é a etiqueta "${other.name}". Escolha outra cor ou edite a existente.`); return; }
    const colorChanged = !!editing.previous && editing.previous !== hex;
    run(async () => {
      const n = await AgendaService.saveColorLabel(hex, editing.name, editing.previous, colorChanged && recolor);
      setEditing(null);
      if (colorChanged && recolor) {
        setNotice(n === 0 ? 'Etiqueta salva. Nenhum evento seu estava com a cor antiga.' : `Etiqueta salva. ${n} evento${n > 1 ? 's' : ''} passa${n > 1 ? 'ram' : 'ou'} para a nova cor.`);
      }
    });
  };

  const remove = (l: ColorLabel) => {
    if (!window.confirm(`Apagar a etiqueta "${l.name}"? Os eventos continuam com a cor, só sem o nome.`)) return;
    run(() => AgendaService.deleteColorLabel(l.color));
  };

  return (
    <Sheet onClose={onClose} wide label="Etiquetas de cor">
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-800">Etiquetas de cor</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-600">Dê nome às cores para saber o que cada uma significa, por exemplo <strong>ADM</strong> = verde e <strong>Fin</strong> = azul. As etiquetas são <strong>só suas</strong>: cada pessoa cria as próprias. Servem para filtrar a sua agenda.</p>

        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
          {labels.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">Nenhuma etiqueta ainda.</li>}
          {labels.map((l) => (
            <li key={l.color} className="px-3 py-2 flex items-center gap-3 text-sm">
              <span className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
              <span className="flex-1 min-w-0 truncate font-medium text-slate-800">{l.name}</span>
              <span className="text-xs text-slate-400 font-mono">{l.color}</span>
              {canEdit && (
                <>
                  <button type="button" onClick={() => { setError(null); setRecolor(true); setEditing({ previous: l.color, name: l.name, color: l.color }); }} className="px-2 py-1 rounded-md text-xs font-semibold text-blue-600 hover:bg-blue-50">Editar</button>
                  <button type="button" onClick={() => remove(l)} disabled={busy} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Apagar ${l.name}`}><Trash2 className="w-4 h-4" /></button>
                </>
              )}
            </li>
          ))}
        </ul>

        {canEdit && !editing && (
          <button type="button" onClick={() => { setError(null); setEditing({ name: '', color: '#059669' }); }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            + Nova etiqueta
          </button>
        )}

        {editing && (
          <form onSubmit={save} className="space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <label className="block text-sm font-medium text-slate-700">Nome
              <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={40} placeholder="Ex.: ADM, Fin, Reunião externa" className={`${inputCls} mt-1`} />
            </label>
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Cor</span>
              <ColorPicker value={editing.color} onChange={(c) => setEditing({ ...editing, color: c || '#2563eb' })} />
            </div>
            {editing.previous && editing.previous !== colorHex(editing.color) && (
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={recolor} onChange={(e) => setRecolor(e.target.checked)} className="mt-0.5" />
                <span>Aplicar a nova cor aos eventos que eu já criei com a cor antiga
                  <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: editing.previous }} /> →
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorHex(editing.color) }} />
                  </span>
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button type="submit" disabled={busy} className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar etiqueta'}</button>
            </div>
          </form>
        )}
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      </div>
    </Sheet>
  );
};

// ---------------- Configurações e compartilhamento de uma agenda ----------------

export const CalendarSettings: React.FC<{
  calendar: AgendaCalendar | null;
  users: AgendaUser[];
  meId: string | undefined;
  /** Agenda › Excluir no módulo: pode criar agendas abertas */
  canPublic: boolean;
  isAdmin: boolean;
  colorSuggestions: string[];
  labels?: ColorLabel[];
  onClose: () => void;
  onChanged: () => void;
}> = ({ calendar, users, meId, canPublic, isAdmin, colorSuggestions, labels = [], onClose, onChanged }) => {
  const isNew = !calendar;
  const manage = isNew || (calendar?.level ?? 0) >= 3;
  const [name, setName] = useState(calendar?.name || '');
  const [description, setDescription] = useState(calendar?.description || '');
  const [color, setColor] = useState<string>(calendar?.color || 'verde');
  const [isPublic, setIsPublic] = useState(!!calendar?.is_public);
  const [members, setMembers] = useState<CalendarMember[] | null>(isNew ? [] : null);
  const [addUser, setAddUser] = useState('');
  const [addLevel, setAddLevel] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  useEffect(() => {
    if (calendar) AgendaService.members(calendar.id).then(setMembers).catch((e) => { setError(e.message); setMembers([]); });
  }, [calendar]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Dê um nome à agenda.'); return; }
    run(async () => {
      const saved = await AgendaService.saveCalendar({
        id: calendar?.id, name, description: description.trim() || null, color: colorHex(color),
        ...(canPublic && !calendar?.is_personal ? { is_public: isPublic } : {}),
      });
      // Agenda nova: já compartilha com quem foi escolhido
      if (isNew && members) for (const m of members) await AgendaService.setMember(saved.id, m.user_id, m.level);
      onChanged();
      onClose();
    });
  };

  const addMember = () => {
    if (!addUser) return;
    if (isNew) {
      setMembers((l) => [...(l || []).filter((m) => m.user_id !== addUser), { calendar_id: '', user_id: addUser, level: addLevel }]);
      setAddUser('');
      return;
    }
    run(async () => {
      await AgendaService.setMember(calendar!.id, addUser, addLevel);
      setMembers(await AgendaService.members(calendar!.id));
      setAddUser('');
      onChanged();
    });
  };

  const changeLevel = (userId: string, level: 1 | 2 | 3) => {
    if (isNew) { setMembers((l) => (l || []).map((m) => (m.user_id === userId ? { ...m, level } : m))); return; }
    run(async () => {
      await AgendaService.setMember(calendar!.id, userId, level);
      setMembers(await AgendaService.members(calendar!.id));
      onChanged();
    });
  };

  const removeMember = (userId: string) => {
    if (isNew) { setMembers((l) => (l || []).filter((m) => m.user_id !== userId)); return; }
    run(async () => {
      await AgendaService.removeMember(calendar!.id, userId);
      if (userId === meId) { onChanged(); onClose(); return; }
      setMembers(await AgendaService.members(calendar!.id));
      onChanged();
    });
  };

  const remove = () => {
    if (!calendar || !window.confirm(`Excluir a agenda "${calendar.name}" e todos os eventos e atividades dela?`)) return;
    run(async () => {
      await AgendaService.deleteCalendar(calendar.id);
      onChanged();
      onClose();
    });
  };

  const amMember = !!members?.some((m) => m.user_id === meId);
  const canDeleteCal = calendar && !calendar.is_personal && (calendar.owner_id === meId || isAdmin);
  const available = users.filter((u) => u.id !== meId && u.id !== calendar?.owner_id && !members?.some((m) => m.user_id === u.id));

  return (
    <Sheet onClose={onClose} wide label={isNew ? 'Nova agenda' : 'Configurações da agenda'}>
      <form onSubmit={save} className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-800">{isNew ? 'Nova agenda' : manage ? 'Configurações da agenda' : calendar?.name}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>

        {manage ? (
          <>
            <label className="block text-sm font-medium text-slate-700">Nome
              <input autoFocus={isNew} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: TI, Reuniões, Diretoria" className={`${inputCls} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-slate-700">Descrição
              <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Opcional" className={`${inputCls} mt-1`} />
            </label>
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Cor</span>
              <ColorPicker value={color} onChange={(c) => setColor(c || 'azul')} suggestions={colorSuggestions} labels={labels} />
            </div>
            {canPublic && !calendar?.is_personal && (
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4 mt-0.5 rounded" />
                <span className="text-sm text-slate-700">
                  <strong className="flex items-center gap-1"><Globe className="w-4 h-4" /> Agenda aberta</strong>
                  Todos com acesso à Agenda veem os eventos. Quem tem Agenda › Editar também cria e altera.
                </span>
              </label>
            )}
          </>
        ) : (
          <div className="text-sm text-slate-600 space-y-1">
            {calendar?.description && <p>{calendar.description}</p>}
            <p>Dono: {calendar?.owner_name || 'Sistema'} · Seu acesso: <strong>{SHARE_LEVEL_LABEL[calendar!.level]}</strong></p>
          </div>
        )}

        {calendar?.is_personal && (
          <p className="text-xs text-slate-500 flex items-start gap-1.5"><Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Esta é sua agenda pessoal. Só você vê, a não ser que compartilhe abaixo.</p>
        )}

        {/* Compartilhamento */}
        {(manage || amMember) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Compartilhar com pessoas</h4>
            {members === null ? (
              <p className="text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Carregando…</p>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {calendar?.owner_id && (
                  <li className="px-3 py-2 flex items-center gap-2 text-sm">
                    <span className="flex-1 min-w-0 truncate">{calendar.owner_name || userLabel(byId.get(calendar.owner_id))}</span>
                    <span className="text-xs text-slate-500">Dono</span>
                  </li>
                )}
                {members.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{calendar?.is_public ? 'Aberta para todos com acesso à Agenda.' : 'Ainda não compartilhada.'}</li>}
                {members.map((m) => (
                  <li key={m.user_id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1 min-w-[8rem] truncate">{userLabel(byId.get(m.user_id))}{m.user_id === meId ? ' (você)' : ''}</span>
                    {manage ? (
                      <>
                        <select value={m.level} onChange={(e) => changeLevel(m.user_id, Number(e.target.value) as 1 | 2 | 3)} disabled={busy} className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white" aria-label="Nível">
                          {([1, 2, 3] as const).map((l) => <option key={l} value={l}>{SHARE_LEVEL_LABEL[l]}</option>)}
                        </select>
                        <button type="button" onClick={() => removeMember(m.user_id)} disabled={busy} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Remover"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">{SHARE_LEVEL_LABEL[m.level]}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {manage && (
              <div className="flex flex-wrap gap-2">
                <select value={addUser} onChange={(e) => setAddUser(e.target.value)} className="flex-1 min-w-[10rem] px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white" aria-label="Pessoa">
                  <option value="">Adicionar pessoa…</option>
                  {available.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}{u.email && u.full_name ? ` · ${u.email}` : ''}</option>)}
                </select>
                <select value={addLevel} onChange={(e) => setAddLevel(Number(e.target.value) as 1 | 2 | 3)} className="px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white" aria-label="Nível de acesso">
                  {([1, 2, 3] as const).map((l) => <option key={l} value={l}>{SHARE_LEVEL_LABEL[l]}</option>)}
                </select>
                <button type="button" onClick={addMember} disabled={!addUser || busy} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-40">Compartilhar</button>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-rose-700">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex gap-2">
            {canDeleteCal && (
              <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold text-rose-700 hover:bg-rose-50"><Trash2 className="w-4 h-4" /> Excluir agenda</button>
            )}
            {!manage && amMember && meId && (
              <button type="button" onClick={() => removeMember(meId)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-100"><LogOut className="w-4 h-4" /> Sair desta agenda</button>
            )}
          </div>
          {manage && (
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button type="submit" disabled={busy} className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar'}</button>
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
};
