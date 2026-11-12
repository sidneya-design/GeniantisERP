import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../common/Avatar';
import { Bell, LogOut, UserCircle2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../../types';
import { getDefaultRouteForRole } from '../../lib/permissions';

export const Header: React.FC = () => {
  const { profile, signOut, isMockSession, switchDevRole } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    adm: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ti: 'bg-blue-100 text-blue-800 border-blue-200',
    rh: 'bg-pink-100 text-pink-800 border-pink-200',
    financeiro: 'bg-amber-100 text-amber-800 border-amber-200',
    consulta: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin (Total)',
    adm: 'ADM (Sem Domínios/Config)',
    ti: 'TI (Ativos, Entregas, Manut., Domínios)',
    rh: 'RH (Visão Geral, Funcionários, Aniver.)',
    financeiro: 'Financeiro (Assinaturas e Relatórios)',
    consulta: 'Consulta (Somente Leitura)',
  };

  const handleRoleChange = (newRole: UserRole) => {
    if (switchDevRole) {
      switchDevRole(newRole);
      navigate(getDefaultRouteForRole(newRole));
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20 shadow-xs">
      <div className="flex items-center space-x-3">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">
          Painel de Gestão Corporativa
        </h1>
        {isMockSession && (
          <span className="hidden md:inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Modo Local
          </span>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Seletor de Perfil Rápido */}
        {isMockSession && switchDevRole && (
          <div className="flex items-center text-xs space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
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
            </select>
          </div>
        )}

        {/* Central de Avisos */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg relative transition-colors"
            title="Avisos do Sistema"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs z-50">
              <div className="flex items-center justify-between font-semibold text-slate-800 mb-2 border-b pb-2">
                <span>Avisos Internos</span>
                <span className="text-blue-600 cursor-pointer">Ver todos</span>
              </div>
              <div className="space-y-2">
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-900">
                  <div className="font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Perfis Configurados
                  </div>
                  <p className="text-blue-700 mt-0.5">
                    Perfis Admin, ADM, TI e RH configurados com permissões granulares por módulo.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Perfil e Identificação */}
        <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-slate-800">
              {profile?.full_name || 'Usuário'}
            </div>
            <div className="flex items-center justify-end mt-0.5">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  profile?.role ? roleColors[profile.role] : 'bg-slate-100 text-slate-700'
                }`}
              >
                {profile?.role ? roleLabels[profile.role] : 'Carregando...'}
              </span>
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
