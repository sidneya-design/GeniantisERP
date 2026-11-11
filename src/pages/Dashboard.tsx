import React from 'react';
import { 
  Users, 
  Laptop, 
  ArrowLeftRight, 
  Wrench, 
  CreditCard, 
  Globe, 
  Cake, 
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();

  const metrics = [
    {
      title: 'Funcionários Ativos',
      value: '42',
      detail: '2 afastados • 0 pendências',
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      link: '/funcionarios',
    },
    {
      title: 'Ativos de TI em Uso',
      value: '68 / 85',
      detail: '12 disponíveis • 5 em manutenção',
      icon: Laptop,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      link: '/ativos',
    },
    {
      title: 'Entregas & Empréstimos',
      value: '68',
      detail: '3 devoluções previstas esta semana',
      icon: ArrowLeftRight,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      link: '/movimentacoes',
    },
    {
      title: 'Licenças Atribuídas',
      value: '114 / 130',
      detail: '16 licenças disponíveis',
      icon: CreditCard,
      color: 'text-purple-600 bg-purple-50 border-purple-100',
      link: '/assinaturas',
    },
    {
      title: 'Domínios Monitorados',
      value: '8',
      detail: '1 com renovação em 25 dias',
      icon: Globe,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
      link: '/dominios',
    },
    {
      title: 'Aniversariantes do Mês',
      value: '5',
      detail: '1 aniversariante hoje!',
      icon: Cake,
      color: 'text-rose-600 bg-rose-50 border-rose-100',
      link: '/aniversariantes',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Boas-vindas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Olá, {profile?.full_name || 'Usuário'}! 👋
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Painel de controle unificado Geniantis. Acompanhe os ativos, licenças, pessoas e pendências.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <Link
            to="/movimentacoes"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" /> Nova Entrega
          </Link>
          <Link
            to="/relatorios"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
          >
            <FileText className="w-4 h-4" /> Relatórios
          </Link>
        </div>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {metrics.map((item, index) => (
          <Link
            key={index}
            to={item.link}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-md transition-all flex items-start justify-between group"
          >
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {item.title}
              </span>
              <div className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                {item.value}
              </div>
              <p className="text-xs text-slate-500 font-medium">{item.detail}</p>
            </div>
            <div className={`p-3 rounded-xl border ${item.color}`}>
              <item.icon className="w-6 h-6" />
            </div>
          </Link>
        ))}
      </div>

      {/* Seção Operacional e Alertas de Atenção Imediata */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas e Pendências */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Pendências e Alertas Críticos
            </h3>
            <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
              3 Requerem Atenção
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs flex-1">
                <span className="font-semibold text-slate-800 block">
                  Renovação de Domínio Próxima: geniantis.com.br
                </span>
                <span className="text-slate-600">
                  Expira em 25 dias (07/03/2026). Responsável: Sidney A.
                </span>
              </div>
              <Link to="/dominios" className="text-xs text-blue-600 hover:underline font-semibold">
                Ver
              </Link>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Wrench className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs flex-1">
                <span className="font-semibold text-slate-800 block">
                  Manutenção Aberta: Notebook Dell Latitude 3420 (PAT-0042)
                </span>
                <span className="text-slate-600">
                  Em assistência técnica autorizada há 6 dias.
                </span>
              </div>
              <Link to="/manutencoes" className="text-xs text-blue-600 hover:underline font-semibold">
                Ver
              </Link>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs flex-1">
                <span className="font-semibold text-slate-800 block">
                  Provisionamento de Licença Pendente: Microsoft 365 E3
                </span>
                <span className="text-slate-600">
                  Solicitado para nova contratação no departamento TI.
                </span>
              </div>
              <Link to="/assinaturas" className="text-xs text-blue-600 hover:underline font-semibold">
                Ver
              </Link>
            </div>
          </div>
        </div>

        {/* Resumo Financeiro de Aplicativos e Assinaturas */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Financeiro das Assinaturas & Aplicativos
            </h3>
            <span className="text-xs text-slate-500">Mês Atual (Fev/2026)</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Custo Mensal Equivalente</span>
              <div className="text-xl font-bold text-slate-800 mt-1">R$ 4.850,00</div>
              <span className="text-[11px] text-emerald-600">Dentro do previsto</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Cobranças em Aberto</span>
              <div className="text-xl font-bold text-slate-800 mt-1">R$ 1.280,00</div>
              <span className="text-[11px] text-amber-600">2 faturas a vencer</span>
            </div>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="font-medium text-slate-700">Google Workspace (35 licenças)</span>
              <span className="font-semibold text-slate-800">R$ 2.450,00 / mês</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="font-medium text-slate-700">Microsoft 365 Business (15 licenças)</span>
              <span className="font-semibold text-slate-800">R$ 1.120,00 / mês</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="font-medium text-slate-700">OpenAI ChatGPT Teams & Gemini</span>
              <span className="font-semibold text-slate-800">R$ 780,00 / mês</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
