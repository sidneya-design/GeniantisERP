import React, { useState } from 'react';
import { Users, Plus, Search, Filter, Download, UserCheck, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Employees: React.FC = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('todos');

  // Dados demonstrativos compatíveis com o modelo do banco
  const employees = [
    {
      id: '1',
      full_name: 'Sidney Alberto',
      preferential_name: 'Sidney',
      email: 'sidney.a@geniantis.com',
      phone: '(11) 98765-4321',
      department: 'Tecnologia da Informação',
      role_title: 'Coordenador de TI',
      unit: 'Matriz - São Paulo',
      manager: 'Diretoria Executiva',
      admission_date: '2021-03-15',
      status: 'ativo',
      assets_count: 3,
      licenses_count: 4,
    },
    {
      id: '2',
      full_name: 'Juliana Ferreira',
      preferential_name: 'Ju',
      email: 'juliana.f@geniantis.com',
      phone: '(11) 97654-3210',
      department: 'Recursos Humanos',
      role_title: 'Analista de RH Sênior',
      unit: 'Matriz - São Paulo',
      manager: 'Gerência de RH',
      admission_date: '2022-07-01',
      status: 'ativo',
      assets_count: 2,
      licenses_count: 2,
    },
    {
      id: '3',
      full_name: 'Carlos Eduardo Santos',
      preferential_name: 'Eduardo',
      email: 'carlos.s@geniantis.com',
      phone: '(11) 96543-2109',
      department: 'Financeiro / Administrativo',
      role_title: 'Especialista Financeiro',
      unit: 'Matriz - São Paulo',
      manager: 'Controladoria',
      admission_date: '2023-01-10',
      status: 'ativo',
      assets_count: 1,
      licenses_count: 3,
    },
    {
      id: '4',
      full_name: 'Mariana Lima de Souza',
      preferential_name: 'Mariana',
      email: 'mariana.l@geniantis.com',
      phone: '(11) 95432-1098',
      department: 'Operações',
      role_title: 'Supervisora de Operações',
      unit: 'Filial 1',
      manager: 'Diretoria de Operações',
      admission_date: '2020-11-20',
      status: 'afastado',
      assets_count: 2,
      licenses_count: 1,
    },
  ];

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
          <h2 className="text-2xl font-bold text-slate-800">Gestão de Funcionários</h2>
          <p className="text-slate-500 text-sm mt-1">
            Cadastro unificado, histórico de movimentações, ativos em custódia e licenças vinculadas.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors">
            <Plus className="w-4 h-4" /> Novo Funcionário
          </button>
        </div>
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
                <th className="px-6 py-4">Ativos Vinculados</th>
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
                    <div className="text-xs text-slate-500">{emp.role_title}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{emp.unit}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {emp.assets_count} equipamentos • {emp.licenses_count} licenças
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        emp.status === 'ativo'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {emp.status === 'ativo' ? 'Ativo' : 'Afastado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
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
    </div>
  );
};
