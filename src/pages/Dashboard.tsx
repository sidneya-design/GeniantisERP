import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Laptop, 
  ArrowLeftRight, 
  Wrench, 
  CreditCard, 
  Globe, 
  Cake, 
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { EmployeeService } from '../services/employeeService';
import { AssetService } from '../services/assetService';

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [employeeStats, setEmployeeStats] = useState({ active: 0, away: 0, birthdays: 0 });
  const [assetStats, setAssetStats] = useState({ inUse: 0, total: 0, available: 0, maintenance: 0 });

  useEffect(() => {
    let active = true;
    Promise.all([EmployeeService.getEmployees(), AssetService.getAssets()])
      .then(([employees, assets]) => {
        if (!active) return;
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
        const visibleEmployees = employees.filter((employee) => employee.status !== 'desligado');
        setEmployeeStats({
          active: employees.filter((employee) => employee.status === 'ativo').length,
          away: employees.filter((employee) => employee.status === 'afastado').length,
          birthdays: visibleEmployees.filter((employee) => employee.birth_date?.slice(5, 7) === currentMonth).length,
        });
        setAssetStats({
          inUse: assets.filter((asset) => asset.status === 'em_uso').length,
          total: assets.length,
          available: assets.filter((asset) => asset.status === 'disponivel').length,
          maintenance: assets.filter((asset) => asset.status === 'em_manutencao').length,
        });
      })
      .catch((error) => console.error('Erro ao carregar métricas do Dashboard:', error));

    return () => {
      active = false;
    };
  }, []);

  const metrics = [
    {
      title: 'Funcionários Ativos',
      value: String(employeeStats.active),
      detail: `${employeeStats.away} afastado(s) • ${employeeStats.active + employeeStats.away} visíveis`,
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      link: '/funcionarios',
    },
    {
      title: 'Ativos de TI em Uso',
      value: `${assetStats.inUse} / ${assetStats.total}`,
      detail: `${assetStats.available} disponível(is) • ${assetStats.maintenance} em manutenção`,
      icon: Laptop,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      link: '/ativos',
    },
    {
      title: 'Entregas & Empréstimos',
      value: '0',
      detail: 'Nenhuma movimentação registrada',
      icon: ArrowLeftRight,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      link: '/movimentacoes',
    },
    {
      title: 'Licenças Atribuídas',
      value: '0 / 0',
      detail: 'Nenhuma licença cadastrada',
      icon: CreditCard,
      color: 'text-purple-600 bg-purple-50 border-purple-100',
      link: '/assinaturas',
    },
    {
      title: 'Domínios Monitorados',
      value: '0',
      detail: 'Nenhum domínio cadastrado',
      icon: Globe,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
      link: '/dominios',
    },
    {
      title: 'Aniversariantes do Mês',
      value: String(employeeStats.birthdays),
      detail: employeeStats.birthdays === 0 ? 'Nenhum aniversariante neste mês' : 'Cadastrado(s) neste mês',
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
              0 Requerem Atenção
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-sm text-slate-500 text-center">
            Nenhuma pendência ou alerta registrado.
          </div>
        </div>

        {/* Resumo Financeiro de Aplicativos e Assinaturas */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Financeiro das Assinaturas & Aplicativos
            </h3>
            <span className="text-xs text-slate-500">Mês atual</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Custo Mensal Equivalente</span>
              <div className="text-xl font-bold text-slate-800 mt-1">R$ 0,00</div>
              <span className="text-[11px] text-slate-500">Nenhuma assinatura cadastrada</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Cobranças em Aberto</span>
              <div className="text-xl font-bold text-slate-800 mt-1">R$ 0,00</div>
              <span className="text-[11px] text-slate-500">Nenhuma cobrança em aberto</span>
            </div>
          </div>

          <div className="pt-1 text-xs text-slate-500 text-center">
            Cadastre assinaturas para acompanhar custos e cobranças aqui.
          </div>
        </div>
      </div>
    </div>
  );
};

