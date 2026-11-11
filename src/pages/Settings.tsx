import React, { useState } from 'react';
import { Settings as SettingsIcon, Building2, Shield, Users, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Settings: React.FC = () => {
  const { profile } = useAuth();
  const [orgName, setOrgName] = useState('Geniantis');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Configurações Gerais</h2>
          <p className="text-slate-500 text-sm mt-1">
            Parâmetros da organização, unidades, departamentos e controle de acesso administrativo.
          </p>
        </div>
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Configurações atualizadas com sucesso!</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identidade da Organização */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base border-b pb-3 border-slate-100">
            <Building2 className="w-5 h-5 text-blue-600" />
            Identidade Organizacional
          </h3>

          <form onSubmit={handleSave} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Nome da Organização
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Fuso Horário Padrão
              </label>
              <input
                type="text"
                disabled
                value="America/Sao_Paulo (UTC-3)"
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-600"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Todas as datas de vencimento e logs operam no horário de Brasília.
              </span>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" /> Salvar Alterações
            </button>
          </form>
        </div>

        {/* Informações de Segurança e Governança */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base border-b pb-3 border-slate-100">
            <Shield className="w-5 h-5 text-purple-600" />
            Governança & RLS Ativo
          </h3>

          <div className="space-y-3 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800 block mb-0.5">
                Segurança em Nível de Linha (PostgreSQL RLS)
              </span>
              <p className="text-slate-500">
                Todas as consultas diretas passam pela checagem de role no Supabase. O frontend não pode burlar as permissões de gravação ou exclusão.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800 block mb-0.5">
                Proteção de Chaves de Serviço
              </span>
              <p className="text-slate-500">
                A chave <code>service_role</code> não está exposta no cliente. Somente a chave anônima pública e funções backend autenticadas executam tarefas privilegiadas.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800 block mb-0.5">
                Bucket Storage Privado
              </span>
              <p className="text-slate-500">
                Documentos e termos assinados são salvos em buckets com links temporários assinados e expiração configurada.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

