import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../common/Avatar';
import { LogOut, AlertTriangle, Menu } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { UserRole } from '../../types';
import { getDefaultRouteForRole } from '../../lib/permissions';

export const Header: React.FC<{ onMenu?: () => void }> = ({ onMenu }) => {
  const { profile, signOut, isMockSession, switchDevRole } = useAuth();
  const navigate = useNavigate();

  const handleRoleChange = (newRole: UserRole) => {
    if (switchDevRole) {
      switchDevRole(newRole);
      navigate(getDefaultRouteForRole(newRole));
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 sticky top-0 z-20 shadow-xs">
      <div className="flex items-center space-x-3 min-w-0">
        {onMenu && (
          <button type="button" onClick={onMenu} className="md:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100" title="Abrir menu" aria-label="Abrir menu">
            <Menu className="w-6 h-6" />
          </button>
        )}
        <h1 className="text-base md:text-lg font-bold text-slate-800 tracking-tight truncate">
          <span className="md:hidden">Geniantis<span className="text-blue-600">ERP</span></span>
          <span className="hidden md:inline">Painel de Gestão Corporativa</span>
        </h1>
        {isMockSession && (
          <span className="hidden md:inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Modo Local
          </span>
        )}
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Seletor de Perfil Rápido */}
        {isMockSession && switchDevRole && (
          <div className="hidden md:flex items-center text-xs space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <span className="text-slate-500 font-medium">Perfil:</span>
            <select
              value={profile?.role || 'admin'}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="admin">Admin (Vê tudo)</option>
              <option value="adm">ADM (Sem Domínios/Config)</option>
              <option value="ti">TI (Ativos, Entregas, Manut., Domínios)</option>
              <option value="rh">RH (Visão Geral, Funcionários, Aniversariantes)</option>
              <option value="funcionario">Funcionário (Só o próprio ponto)</option>
            </select>
          </div>
        )}

        {/* Central de Avisos */}
        <NotificationBell />

        {/* Perfil e Identificação */}
        <div className="flex items-center space-x-2 md:space-x-3 pl-2 md:pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-slate-800">
              {profile?.full_name || 'Usuário'}
            </div>
          </div>
          <Link to="/perfil" title="Meu Perfil" className="rounded-full ring-2 ring-transparent hover:ring-blue-300 transition">
            <Avatar src={profile?.avatar_url} name={profile?.full_name} email={profile?.email} size={36} />
          </Link>
          <button
            onClick={signOut}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Sair do sistema"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
