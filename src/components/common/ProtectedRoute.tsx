import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ModuleKey } from '../../types';
import { ShieldAlert } from 'lucide-react';
import { getDefaultRouteForRole } from '../../lib/permissions';

interface ProtectedRouteProps {
  moduleKey?: ModuleKey;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ moduleKey, children }) => {
  const { user, profile, loading, canAccess } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-600">Carregando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!user && !profile) {
    return <Navigate to="/login" replace />;
  }

  if (moduleKey && !canAccess(moduleKey)) {
    const defaultRoute = getDefaultRouteForRole(profile?.role);
    // Se a rota atual é overview e o perfil tem outra rota padrão (como TI -> /ativos), redireciona automaticamente
    if (moduleKey === 'overview' && defaultRoute !== '/') {
      return <Navigate to={defaultRoute} replace />;
    }

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-12 shadow-xs">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-sm text-slate-600 mt-2">
          Seu perfil atual (<span className="font-semibold uppercase">{profile?.role}</span>) não possui permissão para acessar este módulo.
        </p>
        <div className="mt-6">
          <Link
            to={defaultRoute}
            className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            Ir para página inicial do perfil
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
