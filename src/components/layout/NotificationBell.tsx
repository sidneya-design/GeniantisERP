import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CalendarDays, CheckCheck, Share2, UserCheck, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AppNotification, NotificationService } from '../../services/notificationService';

const ICON: Record<string, React.ElementType> = {
  agenda_share: Share2,
  agenda_invite: CalendarDays,
  agenda_assign: UserCheck,
  agenda_reminder: BellRing,
};

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d < 7 ? `há ${d} dia${d > 1 ? 's' : ''}` : new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/** Sino do cabeçalho: avisos de compartilhamento, convites e atividades atribuídas */
export const NotificationBell: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(() => {
    if (!isSupabaseConfigured || !profile?.id) return;
    NotificationService.list().then(setItems).catch(() => undefined);
  }, [profile?.id]);

  // Carrega ao entrar, a cada minuto e quando a janela volta ao foco
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => { clearInterval(t); window.removeEventListener('focus', load); };
  }, [load]);

  const unread = items.filter((n) => !n.read_at).length;

  const openItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.read_at) {
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      NotificationService.markRead([n.id]).catch(() => undefined);
    }
    if (n.link) navigate(n.link);
  };

  const readAll = () => {
    setItems((l) => l.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    NotificationService.markRead().catch(() => undefined);
  };

  const remove = (n: AppNotification) => {
    setItems((l) => l.filter((x) => x.id !== n.id));
    NotificationService.remove(n.id).catch(() => undefined);
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg relative transition-colors"
        title="Avisos"
        aria-label={unread ? `Avisos: ${unread} não lido(s)` : 'Avisos'}
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800">Avisos</span>
              {unread > 0 && (
                <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar todos como lidos
                </button>
              )}
            </div>
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Nenhum aviso por enquanto.</li>}
              {items.map((n) => {
                const Icon = ICON[n.kind] || Bell;
                return (
                  <li key={n.id} className={`group flex items-start gap-3 px-4 py-3 ${n.read_at ? '' : 'bg-blue-50/60'}`}>
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${n.read_at ? 'text-slate-400' : 'text-blue-600'}`} />
                    <button type="button" onClick={() => openItem(n)} className="flex-1 min-w-0 text-left">
                      <span className={`block text-sm break-words ${n.read_at ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>{n.title}</span>
                      {n.body && <span className="block text-xs text-slate-500 mt-0.5 break-words whitespace-pre-line">{n.body}</span>}
                      <span className="block text-[11px] text-slate-400 mt-0.5">{ago(n.created_at)}</span>
                    </button>
                    <button type="button" onClick={() => remove(n)} className="p-1 rounded text-slate-300 hover:text-slate-600 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Apagar aviso">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};
