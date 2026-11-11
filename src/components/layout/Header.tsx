import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, LogOut, UserCircle2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../../types';

export const Header: React.FC = () => {
  const { profile, signOut, isMockSession, switchDevRole } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    ti: 'bg-blue-100 text-blue-800 border-blue-200',
    rh: 'bg-pink-100 text-pink-800 border-pink-200',
    financeiro: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    consulta: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    ti: 'TI / Operações',
    rh: 'Recursos Humanos',
    financeiro: 'Financeiro',
    consulta: 'Apenas Consulta',
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
            Modo Local / Simulação
          </span>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Seletor de Perfil Rápido para validação das permissões RBAC */}
        {switchDevRole && (
          <div className="flex items-center text-xs space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <span className="text-slate-500 font-medium">Testar Perfil:</span>
            <select
              value={profile?.role || 'admin'}
              onChange={(e) => switchDevRole(e.target.value as UserRole)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="admin">Admin</option>
              <option value="ti">TI</option>
              <option value="rh">RH</option>
              <option value="financeiro">Financeiro</option>
              <option value="consulta">Consulta</option>
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Módulo Aniversariantes Pronto
                  </div>
                  <p className="text-blue-700 mt-0.5">
                    Aplicativo ParabénsFlow analisado e pronto para a etapa de integração.
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                  <div className="font-medium">Segurança RBAC Ativa</div>
                  <p className="text-slate-500 mt-0.5">
                    5 perfis operacionais e permissões ativas em todos os 10 módulos.
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
          <UserCircle2 className="w-9 h-9 text-slate-400" />
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

