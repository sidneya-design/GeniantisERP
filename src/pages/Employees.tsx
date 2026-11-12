import React, { useState, useEffect } from 'react';
import { Avatar } from '../components/common/Avatar';
import { 
  Users, 
  Plus, 
  Search, 
  Download, 
  Eye, 
  Cake, 
  X, 
  CheckCircle2, 
  ShieldAlert,
  Building2,
  Camera,
  Calendar,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../lib/usePermission';
import { EmployeeService } from '../services/employeeService';
import { Employee, EmployeeStatus } from '../types/employee';

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}

export const Employees: React.FC = () => {
  const { profile } = useAuth();
  // CPF, endereço e contato de emergência: só Admin, ADM e RH
  const canSeePrivate = ['admin', 'adm', 'rh'].includes(profile?.role || '');
  // Cadastrar e editar: Admin, RH e TI (ADM só consulta)
  const { canEdit } = usePermission('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Formulário de Novo Funcionário
  const [formData, setFormData] = useState({
    registration_number: '',
    full_name: '',
    preferential_name: '',
    email: '',
    cpf: '',
    phone: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_relationship: '',
    emergency_contact_phone: '',
    department: 'TI',
    role_title: '',
    unit: 'Matriz - São Paulo',
    manager: '',
    admission_date: new Date().toISOString().split('T')[0],
    birth_date: '',
    status: 'ativo' as EmployeeStatus,
    restricted_notes: '',
    photo_url: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const choosePhoto = (file: File | null) => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setEmployees(await EmployeeService.getEmployees());
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível carregar os funcionários.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!formData.full_name || !formData.email) {
      alert('Nome completo e e-mail são obrigatórios.');
      return;
    }

    if (canSeePrivate && formData.cpf && !isValidCpf(formData.cpf)) {
      alert('Informe um CPF válido.');
      return;
    }

    try {
      const wasEditing = Boolean(editingEmployee);
      const saved = await EmployeeService.saveEmployee({ ...formData, id: editingEmployee?.id }, { includePrivate: canSeePrivate });
      if (photoFile) {
        try {
          await EmployeeService.uploadPhoto(saved.id, photoFile);
        } catch (photoError: any) {
          setErrorMessage(`Funcionário salvo, mas a foto não foi enviada: ${photoError.message}`);
        }
      }
      await loadData();
      setSuccessMessage(wasEditing ? 'Funcionário atualizado com sucesso.' : 'Funcionário cadastrado com sucesso.');
      setIsModalOpen(false);
      setEditingEmployee(null);
      setFormData({
        registration_number: '',
        full_name: '',
        preferential_name: '',
        email: '',
        cpf: '',
        phone: '',
        address: '',
        emergency_contact_name: '',
        emergency_contact_relationship: '',
        emergency_contact_phone: '',
        department: 'TI',
        role_title: '',
        unit: 'Matriz - São Paulo',
        manager: '',
        admission_date: new Date().toISOString().split('T')[0],
        birth_date: '',
        status: 'ativo',
        restricted_notes: '',
        photo_url: '',
      });
      choosePhoto(null);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível salvar o funcionário.');
    }
  };

  const handleEdit = (employee: Employee) => {
    setSuccessMessage(null);
    setEditingEmployee(employee);
    setFormData({
      registration_number: employee.registration_number || '',
      full_name: employee.full_name,
      preferential_name: employee.preferential_name || '',
      email: employee.email,
      cpf: employee.cpf || '',
      phone: employee.phone || '',
      address: employee.address || '',
      emergency_contact_name: employee.emergency_contact_name || '',
      emergency_contact_relationship: employee.emergency_contact_relationship || '',
      emergency_contact_phone: employee.emergency_contact_phone || '',
      department: employee.department,
      role_title: employee.role_title,
      unit: employee.unit,
      manager: employee.manager || '',
      admission_date: employee.admission_date,
      birth_date: employee.birth_date || '',
      status: employee.status,
      restricted_notes: employee.restricted_notes || '',
      photo_url: employee.photo_url || '',
    });
    choosePhoto(null);
    setPhotoPreview(employee.photo_url || null);
    setIsDetailsOpen(false);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setSuccessMessage(null);
    setEditingEmployee(null);
    setFormData({
      registration_number: '',
      full_name: '',
      preferential_name: '',
      email: '',
      cpf: '',
      phone: '',
      address: '',
      emergency_contact_name: '',
      emergency_contact_relationship: '',
      emergency_contact_phone: '',
      department: 'TI',
      role_title: '',
      unit: 'Matriz - São Paulo',
      manager: '',
      admission_date: new Date().toISOString().split('T')[0],
      birth_date: '',
      status: 'ativo',
      restricted_notes: '',
      photo_url: '',
    });
    choosePhoto(null);
    setIsModalOpen(true);
  };

  const handleExportCSV = () => {
    const headers = ['Matrícula', 'Nome Completo', 'E-mail', 'Departamento', 'Cargo', 'Unidade', 'Aniversário', 'Situação'];
    const rows = employees.map(e => [
      e.registration_number || '',
      `"${e.full_name}"`,
      e.email,
      `"${e.department}"`,
      `"${e.role_title}"`,
      `"${e.unit}"`,
      e.birth_date ? new Date(e.birth_date).toLocaleDateString('pt-BR') : '',
      e.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `funcionarios_geniantis_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'todos' || emp.department === filterDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">Gestão de Funcionários</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {employees.length} cadastrados
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Cadastro centralizado. As datas de aniversário alimentam automaticamente o módulo <strong>ParabénsFlow</strong>.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button 
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          {canEdit && (
          <button 
            onClick={handleNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Funcionário
          </button>
          )}
        </div>
      </div>

      {/* Sincronização e Avisos */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Cake className="w-5 h-5 text-rose-500 shrink-0" />
          <span>
            <strong>Integração com Aniversariantes Ativa:</strong> O ParabénsFlow lê os dados desta base. Não é necessário cadastrar aniversariantes separadamente.
          </span>
        </div>
        <a 
          href="/aniversariantes" 
          className="text-blue-700 hover:text-blue-900 font-semibold underline shrink-0 ml-2"
        >
          Ver no ParabénsFlow →
        </a>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="todos">Todos os Departamentos</option>
            <option value="TI">TI</option>
            <option value="RH">RH</option>
            <option value="Financeiro">Financeiro</option>
            <option value="Pedagogia">Pedagogia</option>
            <option value="GUESTA">GUESTA</option>
          </select>
        </div>
      </div>

      {/* Tabela de Funcionários */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Funcionário</th>
                <th className="px-6 py-4">Departamento & Cargo</th>
                <th className="px-6 py-4">Unidade</th>
                <th className="px-6 py-4">Aniversário</th>
                <th className="px-6 py-4">Situação</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Carregando funcionários...</td></tr>
              ) : filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <Avatar src={emp.photo_url} name={emp.full_name} email={emp.email} size={36} />
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          {emp.full_name}
                        </span>
                        <span className="text-xs text-slate-500">{emp.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-800 font-medium">{emp.department}</div>
                    <div className="text-xs text-slate-500">{emp.role_title || 'Não informado'}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{emp.unit}</td>
                  <td className="px-6 py-4">
                    {emp.birth_date ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                        <Cake className="w-3 h-3 text-rose-500" />
                        {new Date(emp.birth_date + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Não informado</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        emp.status === 'ativo'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : emp.status === 'afastado'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {emp.status === 'ativo' ? 'Ativo' : emp.status === 'afastado' ? 'Afastado' : 'Desligado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setIsDetailsOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Ver Ficha Completa"
                    >
                      <Eye className="w-4 h-4" /> Ficha
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredEmployees.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Nenhum funcionário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Novo Funcionário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> {editingEmployee ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}
              </h3>
              <button
                onClick={() => { setIsModalOpen(false); setEditingEmployee(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div className="flex items-center gap-4">
                <Avatar src={photoPreview} name={formData.full_name} email={formData.email} size={64} />
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
                    <button
                      type="button"
                      onClick={() => {
                        choosePhoto(null);
                        setFormData({ ...formData, photo_url: '' });
                      }}
                      className="block text-[11px] text-slate-500 hover:text-rose-600"
                    >
                      Remover foto
                    </button>
                  )}
                  <span className="block text-[11px] text-slate-400">Opcional. A imagem é recortada em quadrado.</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo Silva"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome de Preferência
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Eduardo"
                    value={formData.preferential_name}
                    onChange={(e) => setFormData({ ...formData, preferential_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="nome@geniantis.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contato
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 90000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {canSeePrivate && (
                <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CPF
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Endereço
                  </label>
                  <input
                    type="text"
                    placeholder="Rua, número, complemento, bairro e cidade"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do contato emergencial
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Maria da Silva"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Relação
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Mãe, pai, cônjuge..."
                    value={formData.emergency_contact_relationship}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_relationship: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone para contato emergencial
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 90000-0000"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departamento
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="TI">TI</option>
                    <option value="RH">RH</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Pedagogia">Pedagogia</option>
                    <option value="GUESTA">GUESTA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Analista de Sistemas"
                    value={formData.role_title}
                    onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unidade
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="Matriz - São Paulo">Matriz - São Paulo</option>
                    <option value="Filial 1">Filial 1</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Nascimento / Aniversário 🎉
                  </label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="w-full px-3 py-2 border border-rose-300 bg-rose-50/40 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                  />
                  <span className="text-[11px] text-rose-600 mt-0.5 block">
                    Sincroniza automaticamente com o ParabénsFlow.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Admissão
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.admission_date}
                    onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gestor Responsável
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do gestor"
                    value={formData.manager}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingEmployee(null); }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
                >
                  {editingEmployee ? 'Atualizar Funcionário' : 'Salvar Funcionário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ficha Detalhada do Colaborador */}
      {isDetailsOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center space-x-3">
                <Avatar src={selectedEmployee.photo_url} name={selectedEmployee.full_name} email={selectedEmployee.email} size={48} />
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedEmployee.full_name}</h3>
                  <span className="text-xs text-slate-500">{selectedEmployee.email}</span>
                </div>
              </div>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block">Departamento:</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.department}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Cargo:</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.role_title || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Unidade:</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.unit}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Gestor:</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.manager || 'Diretoria'}</span>
              </div>
              {canSeePrivate && (
              <div>
                <span className="text-slate-400 block">Contato emergencial:</span>
                <span className="font-semibold text-slate-800">
                  {selectedEmployee.emergency_contact_name || 'Não informado'}
                  {selectedEmployee.emergency_contact_relationship ? ` · ${selectedEmployee.emergency_contact_relationship}` : ''}
                  {selectedEmployee.emergency_contact_phone ? ` · ${selectedEmployee.emergency_contact_phone}` : ''}
                </span>
              </div>
              )}
              <div>
                <span className="text-slate-400 block">Admissão:</span>
                <span className="font-semibold text-slate-800">
                  {new Date(selectedEmployee.admission_date).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Aniversário:</span>
                <span className="font-semibold text-rose-700">
                  {selectedEmployee.birth_date
                    ? new Date(selectedEmployee.birth_date + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'Não cadastrado'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
              <span className="font-semibold block">Vínculo com ParabénsFlow:</span>
              <p className="text-blue-700">
                Este colaborador está integrado e sincronizado na lista de e-mails de aniversário. Os e-mails serão gerados automaticamente no dia correspondente.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              {canEdit && (
              <button
                onClick={() => handleEdit(selectedEmployee)}
                className="mr-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Editar Cadastro
              </button>
              )}
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
