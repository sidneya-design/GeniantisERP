import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Laptop,
  ArrowLeftRight,
  Wrench,
  CreditCard,
  Globe,
  Cake,
  FileBarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCog,
  Wallet,
  ScrollText,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ModuleKey } from '../../types';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  moduleKey: ModuleKey;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { canAccess, profile } = useAuth();

  const navItems: NavItem[] = [
    { name: 'Visão Geral', path: '/', icon: LayoutDashboard, moduleKey: 'overview' },
    { name: 'Funcionários', path: '/funcionarios', icon: Users, moduleKey: 'employees' },
    { name: 'Ativos de TI', path: '/ativos', icon: Laptop, moduleKey: 'assets' },
    { name: 'Entregas & Devoluções', path: '/movimentacoes', icon: ArrowLeftRight, moduleKey: 'movements' },
    { name: 'Manutenções', path: '/manutencoes', icon: Wrench, moduleKey: 'maintenance' },
    { name: 'Assinaturas & Licenças', path: '/assinaturas', icon: CreditCard, moduleKey: 'subscriptions' },
    { name: 'Financeiro', path: '/financeiro', icon: Wallet, moduleKey: 'finance' },
    { name: 'Domínios & Renovações', path: '/dominios', icon: Globe, moduleKey: 'domains' },
    { name: 'Aniversariantes', path: '/aniversariantes', icon: Cake, moduleKey: 'birthdays', badge: 'Módulo' },
    // Relatórios oculto temporariamente por solicitação do usuário
    // { name: 'Relatórios', path: '/relatorios', icon: FileBarChart2, moduleKey: 'reports' },
    { name: 'Usuários', path: '/usuarios', icon: UserCog, moduleKey: 'settings' },
    { name: 'Logs de Atividade', path: '/logs', icon: ScrollText, moduleKey: 'logs' },
    { name: 'Configurações', path: '/configuracoes', icon: Settings, moduleKey: 'settings' },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-screen transition-all duration-300 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Topo da Sidebar */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
              G
            </div>
            <span className="font-semibold text-lg text-white tracking-wide">
              Geniantis<span className="text-blue-400">ERP</span>
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
              G
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className={`p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ${
            collapsed ? 'hidden' : 'block'
          }`}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin">
        {navItems.map((item) => {
          const hasPermission = canAccess(item.moduleKey);
          if (!hasPermission) return null;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.name}</span>
                  {item.badge && (
                    <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Rodapé da Sidebar */}
      <div className="p-3 border-t border-slate-800">
        {collapsed ? (
          <button
            onClick={onToggle}
            className="w-full flex justify-center p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Expandir menu"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <div className="bg-slate-800/60 rounded-lg p-2.5 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-xs text-slate-300 truncate">
              Perfil: <strong className="text-white uppercase">{profile?.role}</strong>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

