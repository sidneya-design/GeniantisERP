import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  tone?: 'blue' | 'rose';
}

/**
 * Confirmação no visual do ERP, no lugar do window.confirm do navegador.
 * Uso: const { confirm, dialog } = useConfirm(); … {dialog} no JSX;
 *      if (await confirm({ title: '…' })) { … }
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setOptions(opts);
  }), []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const dialog = options ? <ConfirmDialog {...options} onClose={close} /> : null;
  return { confirm, dialog };
}

const ConfirmDialog: React.FC<ConfirmOptions & { onClose: (ok: boolean) => void }> = ({
  title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', icon, tone = 'blue', onClose,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const accent = tone === 'rose'
    ? { badge: 'bg-rose-50 text-rose-600', button: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-300' }
    : { badge: 'bg-blue-50 text-blue-600', button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300' };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent.badge}`}>
            {icon || <HelpCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-title" className="text-base font-bold text-slate-800">{title}</h3>
            {message && <div className="text-sm text-slate-600 mt-1.5">{message}</div>}
          </div>
          <button type="button" onClick={() => onClose(false)} className="text-slate-400 hover:text-slate-600 p-1 -mt-1 -mr-1 rounded-lg" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={() => onClose(false)} className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700">{cancelLabel}</button>
          <button ref={confirmRef} type="button" onClick={() => onClose(true)} className={`px-4 py-2 text-white rounded-lg text-sm font-semibold shadow-xs focus:outline-hidden focus:ring-2 ${accent.button}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};
