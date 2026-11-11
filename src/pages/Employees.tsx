import React, { useState, useEffect } from 'react';
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
  Calendar,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { EmployeeService } from '../services/employeeService';
import { Employee, EmployeeStatus } from '../types/employee';

export const Employees: React.FC = () => {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Formulário de Novo Funcionário
  const [formData, setFormData] = useState({
    registration_number: '',
    full_name: '',
    preferential_name: '',
    email: '',
    phone: '',
    department: 'Tecnologia da Informação',
    role_title: '',
    unit: 'Matriz - São Paulo',
    manager: '',
    admission_date: new Date().toISOString().split('T')[0],
    birth_date: '',
    status: 'ativo' as EmployeeStatus,
    restricted_notes: '',
  });

  const loadData = () => {
    const list = EmployeeService.getEmployees();
    setEmployees(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) {
      alert('Nome completo e e-mail corporativo são obrigatórios.');
      return;
    }

    EmployeeService.saveEmployee(formData);
    loadData();
    setIsModalOpen(false);
    setFormData({
      registration_number: '',
      full_name: '',
      preferential_name: '',
      email: '',
      phone: '',
      department: 'Tecnologia da Informação',
      role_title: '',
      unit: 'Matriz - São Paulo',
      manager: '',
      admission_date: new Date().toISOString().split('T')[0],
      birth_date: '',
      status: 'ativo',
      restricted_notes: '',
    });
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
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Funcionário
          </button>
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
            <option value="Tecnologia da Informação">Tecnologia da Informação</option>
            <option value="Recursos Humanos">Recursos Humanos</option>
            <option value="Financeiro / Administrativo">Financeiro / Administrativo</option>
            <option value="Operações">Operações</option>
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
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                        {emp.full_name[0]}
                      </div>
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
                <Users className="w-5 h-5 text-blue-600" /> Cadastrar Novo Funcionário
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-sm">
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
                    E-mail Corporativo *
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
                    Telefone Corporativo
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 90000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departamento
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="Tecnologia da Informação">Tecnologia da Informação</option>
                    <option value="Recursos Humanos">Recursos Humanos</option>
                    <option value="Financeiro / Administrativo">Financeiro / Administrativo</option>
                    <option value="Operações">Operações</option>
                    <option value="Diretoria">Diretoria</option>
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
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
                >
                  Salvar Funcionário
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
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-lg">
                  {selectedEmployee.full_name[0]}
                </div>
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
