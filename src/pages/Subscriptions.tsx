import React, { useState } from 'react';
import { CreditCard, Plus, DollarSign, Users, Calendar, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Subscriptions: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'contratos' | 'financeiro' | 'licencas'>('contratos');

  const contracts = [
    {
      id: '1',
      service: 'Google Workspace',
      provider: 'Google Cloud LLC',
      category: 'Produtividade & E-mail',
      total_licenses: 35,
      assigned_licenses: 34,
      billing_type: 'por_usuario',
      monthly_cost: 2450.0,
      periodicity: 'mensal',
      contract_renewal: '2026-12-01',
      auto_renew: true,
      status: 'ativa',
      admin_email: 'ti@geniantis.com',
    },
    {
      id: '2',
      service: 'Microsoft 365 Business Standard',
      provider: 'Microsoft Brasil',
      category: 'Office & Colaboração',
      total_licenses: 15,
      assigned_licenses: 14,
      billing_type: 'por_usuario',
      monthly_cost: 1120.0,
      periodicity: 'anual_pago_mensalmente',
      contract_renewal: '2026-08-15',
      auto_renew: true,
      status: 'ativa',
      admin_email: 'ti@geniantis.com',
    },
    {
      id: '3',
      service: 'OpenAI ChatGPT Teams & API',
      provider: 'OpenAI Inc.',
      category: 'Inteligência Artificial',
      total_licenses: 5,
      assigned_licenses: 5,
      billing_type: 'por_usuario',
      monthly_cost: 650.0,
      periodicity: 'mensal',
      contract_renewal: '2026-11-30',
      auto_renew: true,
      status: 'ativa',
      admin_email: 'ti@geniantis.com',
    },
    {
      id: '4',
      service: 'Canva Pro Equipes',
      provider: 'Canva Pty Ltd',
      category: 'Design & Marketing',
      total_licenses: 5,
      assigned_licenses: 4,
      billing_type: 'fixo',
      monthly_cost: 289.0,
      periodicity: 'anual',
      contract_renewal: '2026-09-10',
      auto_renew: true,
      status: 'ativa',
      admin_email: 'marketing@geniantis.com',
    },
  ];

  const financialCharges = [
    {
      id: 'f1',
      service: 'Google Workspace',
      reference_period: 'Janeiro/2026',
      due_date: '2026-01-28',
      amount_expected: 2450.0,
      amount_paid: 2450.0,
      balance: 0.0,
      status: 'pago',
    },
    {
      id: 'f2',
      service: 'Google Workspace',
      reference_period: 'Fevereiro/2026',
      due_date: '2026-02-28',
      amount_expected: 2450.0,
      amount_paid: 0.0,
      balance: 2450.0,
      status: 'aberto',
    },
    {
      id: 'f3',
      service: 'Microsoft 365 Business Standard',
      reference_period: 'Fevereiro/2026',
      due_date: '2026-02-15',
      amount_expected: 1120.0,
      amount_paid: 1120.0,
      balance: 0.0,
      status: 'pago',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Assinaturas, Licenças & Financeiro
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gestão de contratos SaaS, controle de licenças por colaborador e fluxo financeiro exclusivo de assinaturas.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors">
            <Plus className="w-4 h-4" /> Novo Contrato / Assinatura
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('contratos')}
          className={`pb-3 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'contratos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contratos & Serviços ({contracts.length})
        </button>
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`pb-3 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'financeiro'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Área Financeira (Cobranças & Pagamentos)
        </button>
      </div>

      {/* Conteúdo da Tab Contratos */}
      {activeTab === 'contratos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {contracts.map((c) => (
            <div key={c.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    {c.category}
                  </span>
                  <h3 className="text-lg font-bold text-slate-800 mt-0.5">{c.service}</h3>
                  <p className="text-xs text-slate-500">{c.provider}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {c.status.toUpperCase()}
                </span>
              </div>

              {/* Métricas de Licença */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>Licenças Atribuídas:</span>
                  <span className="font-bold">
                    {c.assigned_licenses} de {c.total_licenses} ({c.total_licenses - c.assigned_licenses} disponíveis)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${(c.assigned_licenses / c.total_licenses) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 border-t pt-3 border-slate-100">
                <div>
                  <span className="text-slate-400 block">Custo Mensal Estimado:</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {c.monthly_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Renovação Contratual:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(c.contract_renewal).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <span className="text-slate-500">Admin: {c.admin_email}</span>
                <button className="text-blue-600 hover:underline font-semibold">
                  Gerenciar Atribuições →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conteúdo da Tab Financeiro */}
      {activeTab === 'financeiro' && (
        <div className="space-y-6">
          {/* Métricas Financeiras Consolidadas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 uppercase font-semibold">Custo Mensal Equivalente</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">R$ 4.509,00</div>
              <span className="text-xs text-slate-500">Média normalizada dos contratos</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 uppercase font-semibold">Custo Anual Projetado</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">R$ 54.108,00</div>
              <span className="text-xs text-slate-500">Planejamento anual consolidado</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 uppercase font-semibold">Vencimentos Próximos</span>
              <div className="text-2xl font-bold text-amber-600 mt-1">R$ 2.450,00</div>
              <span className="text-xs text-amber-700">1 cobrança prevista</span>
            </div>
          </div>

          {/* Tabela de Cobranças e Pagamentos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Cobranças por Período & Registro de Pagamentos
              </h3>
              <button className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold hover:bg-emerald-100 transition-colors">
                + Lançar Pagamento
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Serviço / Assinatura</th>
                    <th className="px-6 py-4">Mês de Referência</th>
                    <th className="px-6 py-4">Vencimento</th>
                    <th className="px-6 py-4">Previsto</th>
                    <th className="px-6 py-4">Pago</th>
                    <th className="px-6 py-4">Saldo</th>
                    <th className="px-6 py-4">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {financialCharges.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800">{f.service}</td>
                      <td className="px-6 py-4 text-slate-700">{f.reference_period}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(f.due_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {f.amount_expected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4 text-emerald-700 font-semibold">
                        {f.amount_paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        {f.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            f.status === 'pago'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {f.status === 'pago' ? 'Quitado' : 'A Vencer'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
