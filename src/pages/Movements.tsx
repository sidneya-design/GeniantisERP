import React, { useState } from 'react';
import { ArrowLeftRight, Plus, FileText, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';

export const Movements: React.FC = () => {
  const movements = [
    {
      id: '1',
      employee: 'Sidney Alberto',
      type: 'entrega',
      items: ['PAT-0041 - Dell Latitude 3420', 'PAT-0105 - Monitor LG 29"'],
      date: '2025-02-01',
      term_status: 'assinado',
      user_in_charge: 'Administrador Geniantis',
    },
    {
      id: '2',
      employee: 'Mariana Lima de Souza',
      type: 'entrega',
      items: ['PAT-0201 - Samsung Galaxy A54'],
      date: '2024-11-25',
      term_status: 'assinado',
      user_in_charge: 'Sidney Alberto',
    },
    {
      id: '3',
      employee: 'Lucas Mendes (Desligado)',
      type: 'devolucao',
      items: ['PAT-0033 - Notebook Lenovo ThinkPad'],
      date: '2025-01-15',
      term_status: 'assinado',
      user_in_charge: 'Sidney Alberto',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Entregas, Empréstimos & Devoluções</h2>
          <p className="text-slate-500 text-sm mt-1">
            Custódia de equipamentos, movimentações em lote, geração de termos e histórico atômico.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
            <RotateCcw className="w-4 h-4" /> Registrar Devolução
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors">
            <Plus className="w-4 h-4" /> Nova Entrega em Lote
          </button>
        </div>
      </div>

      {/* Regras e Proteções do Sistema */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Garantia de Integridade e Transações Atômicas:</span>
          <p className="text-blue-800">
            O sistema impede entregas de ativos em manutenção ou baixados, bloqueia entregas simultâneas de um mesmo patrimônio e exige devolução total ou parcial antes de qualquer transferência definitiva.
          </p>
        </div>
      </div>

      {/* Tabela de Movimentações Recentes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            Histórico Recente de Movimentações
          </h3>
          <span className="text-xs text-slate-500">Últimos registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Funcionário</th>
                <th className="px-6 py-4">Itens Movimentados</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Termo / Assinatura</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        mov.type === 'entrega'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {mov.type === 'entrega' ? 'Entrega / Empréstimo' : 'Devolução Concluída'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{mov.employee}</td>
                  <td className="px-6 py-4">
                    <ul className="text-xs space-y-0.5 text-slate-700">
                      {mov.items.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {new Date(mov.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Termo Assinado
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                      title="Visualizar Termo de Responsabilidade"
                    >
                      <FileText className="w-4 h-4" /> Ver Termo
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

