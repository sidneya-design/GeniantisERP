import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LogoGeniantis } from '../components/common/LogoGeniantis';

// Página aberta pelo link do e-mail "Esqueci minha senha".
// O Supabase devolve a sessão de recuperação na URL; o cliente a detecta sozinho.
export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Link expirado/já usado: o Supabase manda o erro no hash da URL
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hash.get('error') || hash.get('error_code')) {
      setStatus('invalid');
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setStatus('ready');
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus('ready');
    });
    // Sem sessão depois de alguns segundos: link inválido
    const timer = setTimeout(() => setStatus((s) => (s === 'checking' ? 'invalid' : s)), 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não conferem.');
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setSaving(false);
      return setError(
        /different|same/i.test(err.message) ? 'A nova senha precisa ser diferente da anterior.' : err.message
      );
    }
    await supabase.auth.signOut();
    navigate('/login', { replace: true, state: { notice: 'Senha criada! Entre com a nova senha.' } });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-md px-6 sm:px-10">
        <LogoGeniantis className="w-full -translate-x-3" />
      </div>
      <div className="mt-8 mx-auto w-full max-w-md bg-white py-8 px-6 sm:px-10 shadow-lg shadow-slate-200/70 rounded-2xl border border-slate-200">
        {status === 'checking' && <p className="text-sm text-slate-500 text-center">Validando o link...</p>}

        {status === 'invalid' && (
          <div className="space-y-4 text-sm">
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>Este link é inválido, expirou ou já foi usado. Peça um novo na tela de login.</span>
            </div>
            <Link to="/login" className="block text-center font-medium text-blue-600 hover:underline">
              Ir para o login
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-800">Criar nova senha</h3>
              <p className="text-sm text-slate-500 mt-1">Use pelo menos 8 caracteres.</p>
            </div>
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}
            {[
              { label: 'Nova senha', value: password, set: setPassword },
              { label: 'Confirmar nova senha', value: confirm, set: setConfirm },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-sm font-medium text-slate-700">{f.label}</label>
                <div className="mt-1 relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
