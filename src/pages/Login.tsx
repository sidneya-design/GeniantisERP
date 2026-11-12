import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, Shield, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { LogoGeniantis } from '../components/common/LogoGeniantis';

export const Login: React.FC = () => {
  const { signIn, isMockSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(isMockSession ? 'admin@geniantis.com' : '');
  const [password, setPassword] = useState(isMockSession ? 'admin123' : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>((location.state as any)?.notice ?? null);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [forgotSent, setForgotSent] = useState<string | null>(null);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível enviar agora. Tente novamente.');
      setForgotSent(data.message);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn(email, password);
      if (res.error) {
        setError(res.error.message || 'Credenciais inválidas.');
      } else {
        // Todos entram na Visão Geral (perfis sem acesso a ela são redirecionados pela rota)
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 bg-[radial-gradient(circle_at_15%_20%,rgba(68,172,225,0.12),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(244,129,32,0.10),transparent_40%)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Mesma largura e padding horizontal do cartão: o logo alinha com os campos */}
      <div className="mx-auto w-full max-w-md px-6 sm:px-10">
        <LogoGeniantis className="w-full -translate-x-3" />
      </div>

      <div className="mt-8 mx-auto w-full max-w-md">
        <div className="bg-white py-8 px-6 shadow-lg shadow-slate-200/70 rounded-2xl sm:px-10 border border-slate-200">
          {notice && !error && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isMockSession && (
            <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-xl text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600" /> Perfis de Acesso Configurados
              </div>
              <p className="text-blue-700">
                Clique em um perfil para preencher e testar suas permissões:
              </p>
              <div className="grid grid-cols-1 gap-1 pt-1 font-mono text-[11px] text-blue-800">
                <button
                  type="button"
                  onClick={() => setEmail('admin@geniantis.com')}
                  className="text-left hover:underline"
                >
                  • <strong>admin@geniantis.com</strong> (Vê Tudo)
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('adm@geniantis.com')}
                  className="text-left hover:underline"
                >
                  • <strong>adm@geniantis.com</strong> (Tudo menos Domínios e Config)
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('ti@geniantis.com')}
                  className="text-left hover:underline"
                >
                  • <strong>ti@geniantis.com</strong> (Ativos, Entregas, Manutenções, Domínios)
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('rh@geniantis.com')}
                  className="text-left hover:underline"
                >
                  • <strong>rh@geniantis.com</strong> (Visão Geral, Funcionários, Aniversariantes)
                </button>
              </div>
            </div>
          )}

          {mode === 'forgot' ? (
            <form className="space-y-5" onSubmit={handleForgot}>
              <div>
                <h3 className="text-base font-bold text-slate-800">Esqueci minha senha</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Informe seu e-mail corporativo. Enviaremos um link para você criar uma nova senha.
                </p>
              </div>
              {forgotSent ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{forgotSent} Confira também a caixa de spam.</span>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      placeholder="nome@geniantis.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {loading ? 'Enviando...' : 'Enviar link'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setForgotSent(null);
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o login
              </button>
            </form>
          ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                E-mail Corporativo
              </label>
              <div className="mt-1 relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="nome@geniantis.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Senha de Acesso
              </label>
              <div className="mt-1 relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? 'Entrando...' : 'Acessar o Painel'}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError(null);
                  setNotice(null);
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};
