import React, { useEffect, useState } from 'react';
import {
  Users,
  Laptop,
  ArrowLeftRight,
  CreditCard,
  Globe,
  Cake,
  AlertTriangle,
  Wallet,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { ModuleKey } from '../types';
import { ROLE_PERMISSIONS } from '../lib/permissions';
import { EmployeeService } from '../services/employeeService';
import { AssetService } from '../services/assetService';
import { MovementService } from '../services/movementService';
import {
  SubscriptionService, currentMonth, todayISO, brl, formatMonth,
} from '../services/subscriptionService';
import { DomainService, daysToExpire } from '../services/domainService';
import { CATEGORY_LABEL, CATEGORY_ORDER, expensesInMonth, loadFinanceData, totalsByCategory } from '../lib/finance';

type Metric = {
  module: ModuleKey;
  title: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  color: string;
  link: string;
};

type Alert = { text: string; link: string; module: ModuleKey };

const daysUntil = (iso: string) =>
  Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${todayISO()}T12:00:00`).getTime()) / 86400000);

export const Dashboard: React.FC = () => {
  const { profile, canAccess } = useAuth();
  const role = profile?.role;
  const canEditMovements = !!(role && ROLE_PERMISSIONS[role]?.movements?.canEdit);

  const [employees, setEmployees] = useState({ active: 0, away: 0, birthdays: 0 });
  const [assets, setAssets] = useState({ inUse: 0, total: 0, available: 0, maintenance: 0 });
  const [movements, setMovements] = useState({ month: 0, pendingTerms: 0 });
  const [licenses, setLicenses] = useState({ used: 0, total: 0, renewSoon: [] as { name: string; days: number }[] });
  const [finance, setFinance] = useState({ total: 0, byCategory: totalsByCategory([]) });
  const [domains, setDomains] = useState({ active: 0, expiring: [] as { name: string; days: number }[] });

  useEffect(() => {
    let active = true;
    const month = currentMonth();
    const monthNum = month.slice(5, 7);

    // Só busca os dados dos módulos que o perfil pode ver
    if (canAccess('employees') || canAccess('birthdays')) {
      EmployeeService.getEmployees()
        .then((list) => {
          if (!active) return;
          const visible = list.filter((e) => e.status !== 'desligado');
          setEmployees({
            active: list.filter((e) => e.status === 'ativo').length,
            away: list.filter((e) => e.status === 'afastado').length,
            birthdays: visible.filter((e) => e.birth_date?.slice(5, 7) === monthNum).length,
          });
        })
        .catch((e) => console.error('Dashboard (funcionários):', e));
    }

    if (canAccess('assets')) {
      AssetService.getAssets()
        .then((list) => {
          if (!active) return;
          setAssets({
            inUse: list.filter((a) => a.status === 'em_uso').length,
            total: list.length,
            available: list.filter((a) => a.status === 'disponivel').length,
            maintenance: list.filter((a) => a.status === 'em_manutencao').length,
          });
        })
        .catch((e) => console.error('Dashboard (ativos):', e));
    }

    if (canAccess('movements')) {
      MovementService.getMovements()
        .then((list) => {
          if (!active) return;
          setMovements({
            month: list.filter((m) => m.movement_date?.slice(0, 7) === month.slice(0, 7)).length,
            pendingTerms: list.filter((m) => m.term_status === 'pendente').length,
          });
        })
        .catch((e) => console.error('Dashboard (movimentações):', e));
    }

    if (canAccess('subscriptions')) {
      Promise.all([SubscriptionService.list(), SubscriptionService.listAssignments()])
        .then(([subs, assigns]) => {
          if (!active) return;
          const activeSubs = subs.filter((s) => s.status === 'ativa');
          setLicenses({
            used: assigns.filter((a) => activeSubs.some((s) => s.id === a.subscription_id)).length,
            total: activeSubs.reduce((n, s) => n + s.total_licenses, 0),
            renewSoon: activeSubs
              .filter((s) => s.renewal_date && daysUntil(s.renewal_date) >= 0 && daysUntil(s.renewal_date) <= 30)
              .map((s) => ({ name: s.service_name, days: daysUntil(s.renewal_date!) })),
          });
        })
        .catch((e) => console.error('Dashboard (assinaturas):', e));
    }

    if (canAccess('domains')) {
      DomainService.list()
        .then((list) => {
          if (!active) return;
          const act = list.filter((d) => d.status === 'ativo');
          setDomains({
            active: act.length,
            expiring: act
              .map((d) => ({ name: d.domain, days: daysToExpire(d) }))
              .filter((d): d is { name: string; days: number } => d.days !== null && d.days <= 30)
              .sort((a, b) => a.days - b.days),
          });
        })
        .catch((e) => console.error('Dashboard (domínios):', e));
    }

    if (canAccess('finance')) {
      loadFinanceData()
        .then((raw) => {
          if (!active) return;
          const items = expensesInMonth(raw, month);
          setFinance({ total: items.reduce((s, i) => s + i.amount, 0), byCategory: totalsByCategory(items) });
        })
        .catch((e) => console.error('Dashboard (financeiro):', e));
    }

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const metrics: Metric[] = [
    {
      module: 'employees',
      title: 'Funcionários Ativos',
      value: String(employees.active),
      detail: `${employees.away} afastado(s)`,
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      link: '/funcionarios',
    },
    {
      module: 'assets',
      title: 'Ativos de TI em Uso',
      value: `${assets.inUse} / ${assets.total}`,
      detail: `${assets.available} disponível(is) • ${assets.maintenance} em manutenção`,
      icon: Laptop,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      link: '/ativos',
    },
    {
      module: 'movements',
      title: 'Entregas & Devoluções no Mês',
      value: String(movements.month),
      detail: movements.pendingTerms ? `${movements.pendingTerms} termo(s) pendente(s) de assinatura` : 'Nenhum termo pendente',
      icon: ArrowLeftRight,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      link: '/movimentacoes',
    },
    {
      module: 'subscriptions',
      title: 'Licenças Atribuídas',
      value: `${licenses.used} / ${licenses.total}`,
      detail: `${Math.max(0, licenses.total - licenses.used)} disponível(is)`,
      icon: CreditCard,
      color: 'text-purple-600 bg-purple-50 border-purple-100',
      link: '/assinaturas',
    },
    {
      module: 'finance',
      title: `Gastos de ${formatMonth(currentMonth())}`,
      value: brl(finance.total),
      detail: CATEGORY_ORDER.filter((c) => finance.byCategory[c] > 0)
        .map((c) => `${CATEGORY_LABEL[c]} ${brl(finance.byCategory[c])}`)
        .join(' • ') || 'Nenhum gasto neste mês',
      icon: Wallet,
      color: 'text-teal-600 bg-teal-50 border-teal-100',
      link: '/financeiro',
    },
    {
      module: 'domains',
      title: 'Domínios Monitorados',
      value: String(domains.active),
      detail: domains.expiring.length ? `${domains.expiring.length} vence(m) em até 30 dias` : 'Nenhum vencimento próximo',
      icon: Globe,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
      link: '/dominios',
    },
    {
      module: 'birthdays',
      title: 'Aniversariantes do Mês',
      value: String(employees.birthdays),
      detail: employees.birthdays === 0 ? 'Nenhum aniversariante neste mês' : 'Neste mês',
      icon: Cake,
      color: 'text-rose-600 bg-rose-50 border-rose-100',
      link: '/aniversariantes',
    },
  ];

  const visibleMetrics = metrics.filter((m) => canAccess(m.module));

  const alerts: Alert[] = [
    ...(movements.pendingTerms
      ? [{ module: 'movements' as ModuleKey, link: '/movimentacoes', text: `${movements.pendingTerms} termo(s) de entrega aguardando assinatura` }]
      : []),
    ...(assets.maintenance
      ? [{ module: 'assets' as ModuleKey, link: '/manutencoes', text: `${assets.maintenance} ativo(s) em manutenção` }]
      : []),
    ...licenses.renewSoon.map((r) => ({
      module: 'subscriptions' as ModuleKey,
      link: '/assinaturas',
      text: `${r.name} renova ${r.days === 0 ? 'hoje' : `em ${r.days} dia(s)`}`,
    })),
    ...domains.expiring.map((d) => ({
      module: 'domains' as ModuleKey,
      link: '/dominios',
      text: d.days < 0 ? `Domínio ${d.name} está vencido` : `Domínio ${d.name} vence ${d.days === 0 ? 'hoje' : `em ${d.days} dia(s)`}`,
    })),
    ...(licenses.total > 0 && licenses.used >= licenses.total
      ? [{ module: 'subscriptions' as ModuleKey, link: '/assinaturas', text: 'Todas as licenças estão em uso' }]
      : []),
  ].filter((a) => canAccess(a.module));

  // O quadro de alertas só aparece para quem vê algum módulo que gera alerta
  const showAlerts = (['movements', 'assets', 'subscriptions', 'domains'] as ModuleKey[]).some((m) => canAccess(m));

  return (
    <div className="space-y-6">
      {/* Boas-vindas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Olá, {profile?.full_name || 'Usuário'}! 👋</h2>
          <p className="text-slate-500 text-sm mt-1">Resumo dos módulos que você acompanha no GeniantisERP.</p>
        </div>
        {canEditMovements && (
          <div className="mt-4 md:mt-0 flex gap-2">
            <Link
              to="/movimentacoes"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" /> Nova Entrega
            </Link>
          </div>
        )}
      </div>

      {/* Métricas: só dos módulos que o perfil acessa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleMetrics.map((item) => (
          <Link
            key={item.module}
            to={item.link}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex items-start justify-between group"
          >
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.title}</span>
              <div className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{item.value}</div>
              <p className="text-xs text-slate-500 font-medium">{item.detail}</p>
            </div>
            <div className={`p-3 rounded-xl border shrink-0 ${item.color}`}>
              <item.icon className="w-6 h-6" />
            </div>
          </Link>
        ))}
      </div>

      {/* Pendências e alertas */}
      {showAlerts && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Pendências e Alertas
            </h3>
            <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
              {alerts.length} requer(em) atenção
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-sm text-slate-500 text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Nenhuma pendência no momento.
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li key={i}>
                  <Link
                    to={a.link}
                    className="flex items-center gap-2 p-3 rounded-xl bg-amber-50/60 border border-amber-100 text-sm text-slate-700 hover:border-amber-300"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> {a.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
