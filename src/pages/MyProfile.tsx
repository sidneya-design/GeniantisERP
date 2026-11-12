import React, { useEffect, useState } from 'react';
import { UserCircle2, Camera, Lock, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/common/Avatar';
import { AvatarService, ROLE_INFO, UserService } from '../services/userService';

type Feedback = { type: 'success' | 'error'; text: string } | null;

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600';
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-1';

const Notice: React.FC<{ feedback: Feedback }> = ({ feedback }) =>
  feedback ? (
    <div
      className={`px-3 py-2 rounded-lg text-sm flex items-start gap-2 border ${
        feedback.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-rose-50 border-rose-200 text-rose-700'
      }`}
    >
      {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{feedback.text}</span>
    </div>
  ) : null;

export const MyProfile: React.FC = () => {
  const { profile, refreshProfile, isMockSession } = useAuth();
  const [name, setName] = useState(profile?.full_name || '');
  const [profileMsg, setProfileMsg] = useState<Feedback>(null);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passMsg, setPassMsg] = useState<Feedback>(null);
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => setName(profile?.full_name || ''), [profile?.full_name]);

  if (!profile) return null;

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setProfileMsg({ type: 'error', text: 'Informe seu nome.' });
    setSavingName(true);
    try {
      await UserService.update(profile.id, { full_name: name.trim() });
      await refreshProfile();
      setProfileMsg({ type: 'success', text: 'Nome atualizado.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setSavingName(false);
    }
  };

  const changePhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      await AvatarService.upload(profile.id, file);
      await refreshProfile();
      setProfileMsg({ type: 'success', text: 'Foto atualizada.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    try {
      await AvatarService.remove(profile.id);
      await refreshProfile();
      setProfileMsg({ type: 'success', text: 'Foto removida.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    if (next.length < 8) return setPassMsg({ type: 'error', text: 'A nova senha precisa ter pelo menos 8 caracteres.' });
    if (next !== confirm) return setPassMsg({ type: 'error', text: 'A confirmação não confere com a nova senha.' });
    if (next === current) return setPassMsg({ type: 'error', text: 'A nova senha precisa ser diferente da atual.' });
    setSavingPass(true);
    try {
      // Confirma a senha atual antes de trocar
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: profile.email, password: current });
      if (authErr) throw new Error('Senha atual incorreta.');
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw new Error(error.message);
      await supabase.from('audit_logs').insert({
        user_id: profile.id,
        user_email: profile.email,
        user_name: profile.full_name,
        action: 'password_change',
        entity: 'sessao',
        summary: 'Trocou a própria senha',
      });
      setCurrent('');
      setNext('');
      setConfirm('');
      setPassMsg({ type: 'success', text: 'Senha alterada. Use a nova senha no próximo acesso.' });
    } catch (err: any) {
      setPassMsg({ type: 'error', text: err.message });
    } finally {
      setSavingPass(false);
    }
  };

  const role = ROLE_INFO[profile.role];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <UserCircle2 className="w-6 h-6 text-blue-600" /> Meu Perfil
        </h2>
        <p className="text-slate-500 text-sm mt-1">Sua foto, seu nome e sua senha de acesso.</p>
      </div>

      {/* Dados */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative">
            <Avatar src={profile.avatar_url} name={profile.full_name} email={profile.email} size={88} />
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-slate-900/40 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-500">{profile.email}</div>
            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${role?.color}`}>{role?.label}</span>
            <div className="flex gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-slate-700 cursor-pointer">
                <Camera className="w-4 h-4" /> {profile.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading || isMockSession}
                  onChange={(e) => {
                    changePhoto(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {profile.avatar_url && (
                <button onClick={removePhoto} disabled={uploading} className="text-slate-500 hover:text-rose-600">
                  Remover foto
                </button>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={saveName} className="space-y-3 border-t border-slate-100 pt-5">
          <div>
            <label className={labelClass}>Nome completo</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <Notice feedback={profileMsg} />
          <button
            type="submit"
            disabled={savingName || name.trim() === profile.full_name}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {savingName ? 'Salvando...' : 'Salvar nome'}
          </button>
          <p className="text-[11px] text-slate-400">O perfil de acesso e o e-mail são alterados pelo Administrador.</p>
        </form>
      </div>

      {/* Senha */}
      <form onSubmit={changePassword} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-600" /> Trocar senha
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Senha atual</label>
            <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} autoComplete="current-password" />
          </div>
          <div>
            <label className={labelClass}>Nova senha</label>
            <input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} autoComplete="new-password" />
          </div>
          <div>
            <label className={labelClass}>Confirmar nova senha</label>
            <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
          </div>
        </div>
        <Notice feedback={passMsg} />
        <button
          type="submit"
          disabled={savingPass || isMockSession}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
        >
          <Lock className="w-4 h-4" /> {savingPass ? 'Alterando...' : 'Alterar senha'}
        </button>
      </form>
    </div>
  );
};
