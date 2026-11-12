import React, { useEffect, useMemo, useState } from 'react';
import { UserCog, Plus, X, KeyRound, RefreshCw, Search, AlertCircle, CheckCircle2, Copy, Users as UsersIcon, Camera, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile, UserRole } from '../types';
import { ROLE_INFO, ROLE_ORDER, UserService, AvatarService, generatePassword } from '../services/userService';
import { Avatar } from '../components/common/Avatar';
import { EmployeeService } from '../services/employeeService';
import { Employee } from '../types/employee';

type Feedback = { type: 'success' | 'error'; text: string } | null;

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600';

export const Users: React.FC = () => {
  const { profile: me, refreshProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'rh' as UserRole, password: '' });
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [pickedEmployeeId, setPickedEmployeeId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '' });
  const [editing, setEditing] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await UserService.list());
    } catch (err: any) {
      setFeedback({ type: 'error', text: `Erro ao carregar usuários: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    EmployeeService.getEmployees().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const activeAdmins = users.filter((u) => u.role === 'admin' && u.is_active).length;

  const flash = (f: Feedback) => {
    setFeedback(f);
    if (f?.type === 'success') setTimeout(() => setFeedback(null), 4000);
  };

  const applyChange = async (user: UserProfile, changes: Partial<Pick<UserProfile, 'role' | 'is_active'>>) => {
    const removingAdmin =
      user.role === 'admin' && user.is_active &&
      ((changes.role && changes.role !== 'admin') || changes.is_active === false);
    if (removingAdmin && activeAdmins <= 1) {
      flash({ type: 'error', text: 'É preciso manter pelo menos um administrador ativo.' });
      return;
    }
    if (user.id === me?.id && removingAdmin) {
      if (!window.confirm('Você vai perder o acesso de administrador. Continuar?')) return;
    }

    setSavingId(user.id);
    try {
      const updated = await UserService.update(user.id, changes);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      flash({ type: 'success', text: `${updated.full_name || updated.email} atualizado.` });
    } catch (err: any) {
      flash({ type: 'error', text: `Não foi possível salvar: ${err.message}` });
    } finally {
      setSavingId(null);
    }
  };

  const openCreate = () => {
    setForm({ full_name: '', email: '', role: 'adm', password: generatePassword() });
    setCreatedCredentials(null);
    setEmployeeQuery('');
    setPickedEmployeeId(null);
    choosePhoto(null);
    setShowCreate(true);
    // Base geral: cadastro de funcionários do ERP
    EmployeeService.getEmployees().then(setEmployees).catch(() => setEmployees([]));
  };

  // Funcionários que ainda não têm usuário no ERP (e não estão desligados)
  const existingEmails = useMemo(() => new Set(users.map((u) => u.email?.toLowerCase())), [users]);
  const linkedEmployeeIds = useMemo(() => new Set(users.map((u) => u.employee_id).filter(Boolean)), [users]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // E-mail do cadastro de funcionários diferente do login do usuário
  const emailMismatch = (u: UserProfile) => {
    const emp = u.employee_id ? employeeById.get(u.employee_id) : undefined;
    return emp?.email && emp.email.toLowerCase() !== u.email?.toLowerCase() ? emp.email.toLowerCase() : null;
  };

  const openEdit = (u: UserProfile) => {
    setEditTarget(u);
    setEditForm({ full_name: u.full_name || '', email: u.email || '' });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    const name = editForm.full_name.trim();
    const email = editForm.email.trim().toLowerCase();
    if (!name) return flash({ type: 'error', text: 'Informe o nome.' });
    const emailChanged = email !== (editTarget.email || '').toLowerCase();
    if (emailChanged && !window.confirm(`O login de ${name} passa a ser ${email} (a senha não muda). Confirmar?`)) return;

    setEditing(true);
    try {
      let updated = editTarget;
      if (name !== editTarget.full_name) updated = await UserService.update(editTarget.id, { full_name: name });
      if (emailChanged) updated = await UserService.updateEmail(editTarget.id, email, editTarget.email);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (updated.id === me?.id) await refreshProfile();
      flash({ type: 'success', text: `${updated.full_name || updated.email} atualizado.` });
      setEditTarget(null);
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setEditing(false);
    }
  };

  const syncEmail = async (u: UserProfile, email: string) => {
    if (!window.confirm(`Alterar o login de ${u.full_name || u.email}\nde ${u.email}\npara ${email}?\n\nA pessoa passa a entrar com o novo e-mail (a senha não muda).`)) return;
    setSavingId(u.id);
    try {
      const updated = await UserService.updateEmail(u.id, email, u.email);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      flash({ type: 'success', text: `Login atualizado para ${email}.` });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setSavingId(null);
    }
  };
  const employeeMatches = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q || pickedEmployeeId) return [];
    return employees
      .filter((e) => e.status !== 'desligado' && e.email && !existingEmails.has(e.email.toLowerCase()) && !linkedEmployeeIds.has(e.id))
      .filter((e) =>
        [e.full_name, e.preferential_name, e.email, e.department].some((v) => v?.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [employees, employeeQuery, existingEmails, linkedEmployeeIds, pickedEmployeeId]);

  const pickEmployee = (e: Employee) => {
    setPickedEmployeeId(e.id);
    setEmployeeQuery(e.preferential_name || e.full_name);
    setForm((f) => ({ ...f, full_name: e.full_name, email: e.email }));
    // Reaproveita a foto do cadastro de funcionários, se houver
    if (e.photo_url && !photoFile) setPhotoPreview(e.photo_url);
  };

  const choosePhoto = (file: File | null) => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  // Troca a foto de um usuário já existente (clique no avatar da lista)
  const changeUserPhoto = async (user: UserProfile, file: File | undefined) => {
    if (!file) return;
    setUploadingId(user.id);
    try {
      const updated = await AvatarService.upload(user.id, file);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      if (user.id === me?.id) await refreshProfile();
      flash({ type: 'success', text: `Foto de ${updated.full_name || updated.email} atualizada.` });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setUploadingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      let created = await UserService.create({ ...form, employee_id: pickedEmployeeId });
      try {
        if (photoFile) created = await AvatarService.upload(created.id, photoFile);
        else if (photoPreview && !photoPreview.startsWith('blob:')) {
          created = await UserService.update(created.id, { avatar_url: photoPreview });
        }
      } catch (err: any) {
        flash({ type: 'error', text: `Usuário criado, mas a foto não foi salva: ${err.message}` });
      }
      setUsers((prev) => [...prev.filter((u) => u.id !== created.id), created].sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '')
      ));
      setCreatedCredentials({ email: form.email.trim().toLowerCase(), password: form.password });
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    try {
      await UserService.resetPassword(resetTarget.id, newPassword, resetTarget.email);
      setCreatedCredentials({ email: resetTarget.email, password: newPassword });
      setResetTarget(null);
    } catch (err: any) {
      flash({ type: 'error', text: err.message });
    } finally {
      setResetting(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Usuários e Perfis</h2>
          <p className="text-slate-500 text-sm mt-1">
            Cadastre quem acessa o ERP e defina o perfil de cada pessoa.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo Usuário
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          )}
          <span className="flex-1">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-current opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Legenda dos perfis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLE_ORDER.map((role) => (
          <div key={role} className="bg-white p-3 rounded-xl border border-slate-200 flex items-start gap-3">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${ROLE_INFO[role].color}`}>
              {ROLE_INFO[role].label}
            </span>
            <span className="text-xs text-slate-500 leading-snug">{ROLE_INFO[role].description}</span>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Usuário</th>
                <th className="text-left px-4 py-3 font-semibold">Perfil</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Carregando usuários...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Nenhum usuário encontrado.</td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'bg-slate-50/60'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <label
                        className="relative group cursor-pointer shrink-0"
                        title="Clique para trocar a foto"
                      >
                        <Avatar src={u.avatar_url} name={u.full_name} email={u.email} size={40} />
                        <span className="absolute inset-0 rounded-full bg-slate-900/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {uploadingId === u.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingId === u.id}
                          onChange={(e) => {
                            changeUserPhoto(u, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800">
                          {u.full_name || '—'}
                          {u.id === me?.id && <span className="ml-2 text-[10px] font-bold text-blue-600">(você)</span>}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                        {emailMismatch(u) && (
                          <div className="mt-1 text-[11px] text-amber-700 flex flex-wrap items-center gap-x-2">
                            <span>No cadastro de funcionários: <strong>{emailMismatch(u)}</strong></span>
                            <button
                              onClick={() => syncEmail(u, emailMismatch(u)!)}
                              disabled={savingId === u.id}
                              className="font-semibold text-blue-600 hover:underline disabled:opacity-50"
                            >
                              Usar este e-mail
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={savingId === u.id}
                      onChange={(e) => applyChange(u, { role: e.target.value as UserRole })}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {!ROLE_ORDER.includes(u.role) && (
                        <option value={u.role} disabled>{ROLE_INFO[u.role]?.label ?? u.role} (sem acesso)</option>
                      )}
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>{ROLE_INFO[r].label}</option>
                      ))}
                    </select>
                    {!ROLE_ORDER.includes(u.role) && (
                      <div className="text-[10px] text-amber-600 mt-1">Não consegue entrar: escolha um perfil.</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={savingId === u.id}
                      onClick={() => applyChange(u, { is_active: !u.is_active })}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                        u.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                      title={u.is_active ? 'Clique para desativar' : 'Clique para ativar'}
                    >
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 mr-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => {
                        setResetTarget(u);
                        setNewPassword(generatePassword());
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Redefinir senha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: novo usuário */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserCog className="w-5 h-5 text-blue-600" /> Novo Usuário
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdCredentials ? (
              <CredentialsBox
                title="Usuário criado!"
                credentials={createdCredentials}
                onCopy={copy}
                onClose={() => setShowCreate(false)}
              />
            ) : (
              <form onSubmit={handleCreate} className="space-y-4 text-sm">
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3">
                  <label className="block text-xs font-semibold text-blue-900 uppercase mb-1">
                    Buscar no cadastro de funcionários
                  </label>
                  <div className="relative">
                    <UsersIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={employeeQuery}
                      onChange={(e) => {
                        setEmployeeQuery(e.target.value);
                        setPickedEmployeeId(null);
                      }}
                      placeholder="Digite o nome, e-mail ou departamento..."
                      className={`${inputClass} pl-9 bg-white`}
                      autoFocus
                    />
                    {pickedEmployeeId && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickedEmployeeId(null);
                          setEmployeeQuery('');
                          setForm((f) => ({ ...f, full_name: '', email: '' }));
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Limpar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {employeeMatches.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {employeeMatches.map((e) => (
                          <li key={e.id}>
                            <button
                              type="button"
                              onClick={() => pickEmployee(e)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50"
                            >
                              <div className="font-semibold text-slate-800">{e.preferential_name || e.full_name}</div>
                              <div className="text-xs text-slate-500">
                                {e.email}{e.department ? ` · ${e.department}` : ''}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-[11px] text-blue-800/70 mt-1 block">
                    {pickedEmployeeId
                      ? 'Nome e e-mail preenchidos a partir do cadastro.'
                      : employeeQuery.trim() && employeeMatches.length === 0
                        ? 'Nenhum funcionário encontrado (ou já tem usuário). Preencha os campos abaixo manualmente.'
                        : 'Quem já tem usuário no ERP ou está desligado não aparece.'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Avatar src={photoPreview} name={form.full_name} email={form.email} size={64} />
                  <div className="space-y-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer">
                      <Camera className="w-4 h-4" /> {photoPreview ? 'Trocar foto' : 'Adicionar foto'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          choosePhoto(e.target.files?.[0] || null);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {photoPreview && (
                      <button type="button" onClick={() => choosePhoto(null)} className="block text-[11px] text-slate-500 hover:text-rose-600">
                        Remover foto
                      </button>
                    )}
                    <span className="block text-[11px] text-slate-400">Opcional. JPG, PNG ou WebP; é recortada em quadrado.</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nome completo</label>
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">E-mail corporativo</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputClass}
                    placeholder="nome@geniantis.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Perfil</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                    className={`${inputClass} bg-white`}
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>{ROLE_INFO[r].label} — {ROLE_INFO[r].description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Senha inicial</label>
                  <div className="flex gap-2">
                    <input
                      required
                      minLength={8}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={`${inputClass} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, password: generatePassword() })}
                      className="px-3 border border-slate-300 hover:bg-slate-50 rounded-lg"
                      title="Gerar outra senha"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">Mínimo de 8 caracteres. Envie para a pessoa por um canal seguro.</span>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={creating} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                    {creating ? 'Criando...' : 'Criar Usuário'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: editar usuário */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleEdit} className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-sm">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" /> Editar usuário
              </h3>
              <button type="button" onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Avatar src={editTarget.avatar_url} name={editForm.full_name} email={editForm.email} size={48} />
              <span className="text-xs text-slate-500">Foto: clique no avatar na lista para trocar.</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nome completo</label>
              <input required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">E-mail de login</label>
              <input required type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
              {emailMismatch(editTarget) && editForm.email.toLowerCase() !== emailMismatch(editTarget) && (
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, email: emailMismatch(editTarget)! })}
                  className="mt-1 text-[11px] text-blue-600 hover:underline"
                >
                  Usar o e-mail do cadastro de funcionários: {emailMismatch(editTarget)}
                </button>
              )}
              <span className="text-[11px] text-slate-400 mt-1 block">Ao mudar o e-mail, a pessoa passa a entrar com o novo. A senha continua a mesma.</span>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" disabled={editing} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                {editing ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: redefinir senha */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleReset} className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-sm">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" /> Redefinir senha
              </h3>
              <button type="button" onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600">
              Nova senha para <strong>{resetTarget.full_name || resetTarget.email}</strong>:
            </p>
            <div className="flex gap-2">
              <input
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputClass} font-mono`}
              />
              <button type="button" onClick={() => setNewPassword(generatePassword())} className="px-3 border border-slate-300 hover:bg-slate-50 rounded-lg" title="Gerar outra senha">
                <RefreshCw className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" disabled={resetting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                {resetting ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Credenciais após redefinir senha */}
      {createdCredentials && !showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <CredentialsBox
              title="Senha redefinida!"
              credentials={createdCredentials}
              onCopy={copy}
              onClose={() => setCreatedCredentials(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const CredentialsBox: React.FC<{
  title: string;
  credentials: { email: string; password: string };
  onCopy: (text: string) => void;
  onClose: () => void;
}> = ({ title, credentials, onCopy, onClose }) => (
  <div className="space-y-4 text-sm">
    <div className="flex items-center gap-2 text-emerald-700 font-semibold">
      <CheckCircle2 className="w-5 h-5" /> {title}
    </div>
    <p className="text-slate-600">Passe estes dados para a pessoa. A senha não será exibida de novo.</p>
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs space-y-1">
      <div>Site: {window.location.origin}</div>
      <div>E-mail: {credentials.email}</div>
      <div>Senha: {credentials.password}</div>
    </div>
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => onCopy(`Site: ${window.location.origin}\nE-mail: ${credentials.email}\nSenha: ${credentials.password}`)}
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Copy className="w-4 h-4" /> Copiar
      </button>
      <button type="button" onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">
        Concluir
      </button>
    </div>
  </div>
);
