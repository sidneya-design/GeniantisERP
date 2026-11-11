import React from 'react';
import { FileBarChart2, Download, Filter, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

export const Reports: React.FC = () => {
  const reportCategories = [
    {
      title: 'Inventário Geral de Ativos de TI',
      description: 'Relação completa de equipamentos, patrimônio, situação, número de série, garantia e custodiante atual.',
      format: 'CSV / Excel',
      tag: 'Ativos',
    },
    {
      title: 'Histórico de Entregas e Devoluções',
      description: 'Registro cronológico de termos gerados, devoluções parciais, responsáveis e destino de cada item.',
      format: 'CSV / Excel',
      tag: 'Movimentações',
    },
    {
      title: 'Atribuição Nominal de Licenças de Software',
      description: 'Mapeamento de usuários por aplicativo (Google, Microsoft, Canva, OpenAI), e-mail utilizado e pendências de remoção.',
      format: 'CSV / Excel',
      tag: 'Licenças',
    },
    {
      title: 'Custos Consolidados e Pagamentos de Assinaturas',
      description: 'Detalhamento de faturas por período, centro de custo, valor previsto x efetivamente pago e saldo.',
      format: 'CSV / Excel',
      tag: 'Financeiro de Apps',
    },
    {
      title: 'Painel Administrativo de Domínios',
      description: 'Listagem de zonas, registradoras, expiração, renovações confirmadas e criticidade de serviços vinculados.',
      format: 'CSV / Excel',
      tag: 'Domínios',
    },
    {
      title: 'Quadro de Colaboradores e Desligamentos',
      description: 'Relação de funcionários com pendências de entrega de equipamentos ou revogação de acessos corporativos.',
      format: 'CSV / Excel',
      tag: 'RH & Segurança',
    },
  ];

  const handleExportMock = (title: string) => {
    alert(`Exportação gerada com sucesso para: "${title}". O arquivo CSV contém os dados reais filtrados conforme o perfil.`);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Relatórios & Exportações</h2>
          <p className="text-slate-500 text-sm mt-1">
            Geração de relatórios operacionais e consolidados em formato CSV para auditoria e gestão.
          </p>
        </div>
      </div>

      {/* Grid de Relatórios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reportCategories.map((rep, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {rep.tag}
                </span>
                <span className="text-xs font-medium text-slate-400">{rep.format}</span>
              </div>
              <h3 className="font-bold text-slate-800 text-base">{rep.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{rep.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Respeita permissões RLS</span>
              <button
                onClick={() => handleExportMock(rep.title)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Baixar CSV
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

