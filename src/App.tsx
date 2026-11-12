import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Páginas
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Assets } from './pages/Assets';
import { Movements } from './pages/Movements';
import { Maintenance } from './pages/Maintenance';
import { Subscriptions } from './pages/Subscriptions';
import { Domains } from './pages/Domains';
import { Birthdays } from './pages/Birthdays';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { Finance } from './pages/Finance';
import { Logs } from './pages/Logs';
import { MyProfile } from './pages/MyProfile';
import { ResetPassword } from './pages/ResetPassword';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <ProtectedRoute moduleKey="overview">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="funcionarios"
              element={
                <ProtectedRoute moduleKey="employees">
                  <Employees />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="ativos"
              element={
                <ProtectedRoute moduleKey="assets">
                  <Assets />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="movimentacoes"
              element={
                <ProtectedRoute moduleKey="movements">
                  <Movements />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="manutencoes"
              element={
                <ProtectedRoute moduleKey="maintenance">
                  <Maintenance />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="assinaturas"
              element={
                <ProtectedRoute moduleKey="subscriptions">
                  <Subscriptions />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="dominios"
              element={
                <ProtectedRoute moduleKey="domains">
                  <Domains />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="aniversariantes"
              element={
                <ProtectedRoute moduleKey="birthdays">
                  <Birthdays />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="relatorios"
              element={
                <ProtectedRoute moduleKey="reports">
                  <Reports />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="financeiro"
              element={
                <ProtectedRoute moduleKey="finance">
                  <Finance />
                </ProtectedRoute>
              }
            />

            <Route path="perfil" element={<MyProfile />} />

            <Route
              path="logs"
              element={
                <ProtectedRoute moduleKey="logs">
                  <Logs />
                </ProtectedRoute>
              }
            />

            <Route
              path="usuarios"
              element={
                <ProtectedRoute moduleKey="settings">
                  <Users />
                </ProtectedRoute>
              }
            />

            <Route
              path="configuracoes"
              element={
                <ProtectedRoute moduleKey="settings">
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Rota coringa de redirecionamento */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

