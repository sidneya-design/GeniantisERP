import React, { useRef, useState, useEffect } from 'react';
import { 
  Cake, 
  ExternalLink, 
  RotateCw, 
  Maximize2, 
  Minimize2, 
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Birthdays: React.FC = () => {
  const { profile, user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserEmail = profile?.email || user?.email || 'admin@geniantis.com';
  const currentUserRole = profile?.role === 'admin' ? 'admin' : (profile?.role === 'ti' || profile?.role === 'rh') ? 'editor' : 'viewer';

  // Sincroniza a sessão com o iframe via postMessage ao carregar ou alternar usuário
  const syncIframeSession = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const ssoData = {
        type: 'GENIANTIS_SSO_SYNC',
        token: 'sso-geniantis-' + btoa(currentUserEmail),
        email: currentUserEmail,
        role: currentUserRole,
      };
      iframeRef.current.contentWindow.postMessage(ssoData, '*');
    }
  };

  useEffect(() => {
    syncIframeSession();
  }, [currentUserEmail, currentUserRole]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    syncIframeSession();
  };

  const handleReload = () => {
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleOpenExternal = () => {
    window.open('/aniversariantes-app/index.html', '_blank');
  };

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-4' : ''}`}>
      {/* Barra de Controle e Status da Integração */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center font-bold">
            <Cake className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">
                ParabénsFlow – Aniversariantes do Mês
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Integrado via SSO
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Aplicativo original conectado com sessão ativa de: <strong className="text-slate-700">{currentUserEmail}</strong> ({currentUserRole.toUpperCase()})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Recarregar aplicativo"
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">Recarregar</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title={isFullscreen ? 'Sair da tela cheia' : 'Expandir para tela cheia'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Normal' : 'Tela Cheia'}</span>
          </button>

          <button
            onClick={handleOpenExternal}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir em Nova Aba</span>
          </button>
        </div>
      </div>

      {/* Container do Aplicativo Original */}
      <div className={`relative bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-xs ${
        isFullscreen ? 'h-[calc(100vh-5rem)]' : 'h-[780px]'
      }`}>
        {isLoading && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center space-y-3 z-10 text-slate-800">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-600">
              Carregando ParabénsFlow e autenticando via SSO...
            </p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src="/aniversariantes-app/index.html"
          title="ParabénsFlow - Aplicativo de Aniversariantes"
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
};
