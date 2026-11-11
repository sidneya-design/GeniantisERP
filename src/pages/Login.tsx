import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, Shield, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn, isMockSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@geniantis.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn(email, password);
      if (res.error) {
        setError(res.error.message || 'Credenciais inválidas.');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center font-bold text-white text-2xl mx-auto shadow-lg shadow-blue-500/30">
          G
        </div>
        <h2 className="mt-4 text-3xl font-extrabold text-white tracking-tight">
          Geniantis<span className="text-blue-400">ERP</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Sistema Integrado de Gestão de Ativos, TI e Pessoas
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isMockSession && (
            <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-xl text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600" /> Modo Local de Desenvolvimento
              </div>
              <p className="text-blue-700">
                Você pode entrar com qualquer perfil para testar as permissões:
              </p>
              <div className="grid grid-cols-2 gap-1 pt-1 font-mono text-[11px] text-blue-800">
                <button
                  type="button"
                  onClick={() => setEmail('admin@geniantis.com')}
                  className="text-left hover:underline"
                >
                  • admin@geniantis.com
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('ti@geniantis.com')}
                  className="text-left hover:underline"
                >
                  • ti@geniantis.com
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('rh@geniantis.com')}
                  className="text-left hover:underline"
                >
                  • rh@geniantis.com
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('financeiro@geniantis.com')}
                  className="text-left hover:underline"
                >
                  • financeiro@geniantis.com
                </button>
              </div>
            </div>
          )}

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
          </form>
        </div>
      </div>
    </div>
  );
};

