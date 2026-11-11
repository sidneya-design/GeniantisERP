import React, { useState } from 'react';
import { Laptop, Plus, Search, QrCode, Filter, Download, Eye, Tag } from 'lucide-react';

export const Assets: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [filterStatus, setFilterStatus] = useState('todos');

  const assets = [
    {
      id: '1',
      patrimony: 'PAT-0041',
      serial_number: 'CND1234ABC',
      category: 'notebook',
      brand: 'Dell',
      model: 'Latitude 3420 i7 16GB 512GB SSD',
      unit: 'Matriz - São Paulo',
      condition: 'excelente',
      status: 'em_uso',
      assigned_to: 'Sidney Alberto',
      warranty_until: '2027-01-15',
    },
    {
      id: '2',
      patrimony: 'PAT-0042',
      serial_number: 'CND5678XYZ',
      category: 'notebook',
      brand: 'Dell',
      model: 'Latitude 3420 i5 8GB 256GB SSD',
      unit: 'Matriz - São Paulo',
      condition: 'bom',
      status: 'em_manutencao',
      assigned_to: 'TI Assistência',
      warranty_until: '2026-08-30',
    },
    {
      id: '3',
      patrimony: 'PAT-0105',
      serial_number: 'MON998877',
      category: 'monitor',
      brand: 'LG',
      model: '29" UltraWide Full HD IPS',
      unit: 'Matriz - São Paulo',
      condition: 'excelente',
      status: 'disponivel',
      assigned_to: null,
      warranty_until: '2026-11-20',
    },
    {
      id: '4',
      patrimony: 'PAT-0201',
      serial_number: 'CEL334455',
      category: 'celular',
      brand: 'Samsung',
      model: 'Galaxy A54 5G 128GB',
      unit: 'Filial 1',
      condition: 'bom',
      status: 'em_uso',
      assigned_to: 'Mariana Lima de Souza',
      warranty_until: '2025-10-10',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'disponivel':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Disponível</span>;
      case 'em_uso':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Em Uso</span>;
      case 'em_manutencao':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Manutenção</span>;
      case 'baixado':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Baixado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Ativos de TI</h2>
          <p className="text-slate-500 text-sm mt-1">
            Inventário corporativo de equipamentos, controle patrimonial, garantias e etiquetas com QR Code.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
            <QrCode className="w-4 h-4" /> Imprimir Etiquetas
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors">
            <Plus className="w-4 h-4" /> Novo Ativo
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por patrimônio, série ou modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="todas">Todas as Categorias</option>
            <option value="notebook">Notebook</option>
            <option value="desktop">Desktop</option>
            <option value="monitor">Monitor</option>
            <option value="celular">Celular / Tablet</option>
            <option value="rede">Equipamentos de Rede</option>
            <option value="perifericos">Periféricos</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="todos">Todas as Situações</option>
            <option value="disponivel">Disponível</option>
            <option value="em_uso">Em Uso</option>
            <option value="em_manutencao">Em Manutenção</option>
            <option value="baixado">Baixado</option>
          </select>
        </div>
      </div>

      {/* Tabela de Ativos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Patrimônio / Equipamento</th>
                <th className="px-6 py-4">Nº de Série</th>
                <th className="px-6 py-4">Responsável Atual</th>
                <th className="px-6 py-4">Local / Unidade</th>
                <th className="px-6 py-4">Garantia</th>
                <th className="px-6 py-4">Situação</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {asset.patrimony}
                        </span>
                        <span className="text-xs text-slate-500">
                          {asset.brand} {asset.model}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-700">
                    {asset.serial_number}
                  </td>
                  <td className="px-6 py-4">
                    {asset.assigned_to ? (
                      <span className="font-semibold text-slate-800">{asset.assigned_to}</span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Nenhum (Em estoque)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{asset.unit}</td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {new Date(asset.warranty_until).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(asset.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                      title="Ver Ficha e Histórico"
                    >
                      <Eye className="w-4 h-4" /> Detalhes
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
