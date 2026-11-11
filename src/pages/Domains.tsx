import React from 'react';
import { Globe, Plus, AlertCircle, CheckCircle2, Shield, ExternalLink, Clock } from 'lucide-react';

export const Domains: React.FC = () => {
  const domains = [
    {
      id: '1',
      domain: 'geniantis.com.br',
      registrar: 'Registro.br',
      organization: 'Fundação Geniantis',
      admin_email: 'ti@geniantis.com',
      responsible: 'Sidney Alberto',
      backup_responsible: 'Diretoria de Operações',
      expiration_date: '2026-03-07',
      auto_renew: true,
      criticality: 'alta',
      status: 'ativo',
      services: ['Site Institucional', 'Google Workspace', 'DNS Cloudflare'],
      days_to_expire: 25,
    },
    {
      id: '2',
      domain: 'geniantis.com',
      registrar: 'Cloudflare Registrar',
      organization: 'Fundação Geniantis',
      admin_email: 'ti@geniantis.com',
      responsible: 'Sidney Alberto',
      backup_responsible: 'Diretoria de Operações',
      expiration_date: '2026-11-15',
      auto_renew: true,
      criticality: 'alta',
      status: 'ativo',
      services: ['Redirecionamento para .com.br'],
      days_to_expire: 278,
    },
    {
      id: '3',
      domain: 'parabensflow.geniantis.com.br',
      is_subdomain: true,
      parent_domain: 'geniantis.com.br',
      registrar: 'Apontamento CNAME / Netlify',
      organization: 'Fundação Geniantis',
      admin_email: 'ti@geniantis.com',
      responsible: 'Sidney Alberto',
      expiration_date: '2026-03-07', // Vinculado ao domínio principal
      criticality: 'media',
      status: 'ativo',
      services: ['Aplicativo de Aniversariantes'],
      days_to_expire: 25,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Domínios & Renovações</h2>
          <p className="text-slate-500 text-sm mt-1">
            Gestão administrativa de nomes de domínio, registradoras, zonas DNS e histórico de renovações.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors">
            <Plus className="w-4 h-4" /> Novo Domínio
          </button>
        </div>
      </div>

      {/* Alerta de renovação iminente */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Atenção para Renovações em Menos de 30 Dias:</span>
          <p className="text-amber-800">
            O domínio <strong>geniantis.com.br</strong> expira em 25 dias (07/03/2026). Confirme o processo junto ao Registro.br e registre a nova expiração após a validação.
          </p>
        </div>
      </div>

      {/* Grid de Domínios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {domains.map((d) => (
          <div key={d.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{d.domain}</h3>
                    <span className="text-xs text-slate-400">{d.registrar}</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    d.days_to_expire <= 30
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {d.days_to_expire <= 30 ? `${d.days_to_expire} dias` : 'Em Dia'}
                </span>
              </div>

              <div className="text-xs space-y-1 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Expiração:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(d.expiration_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Responsável:</span>
                  <span className="font-medium text-slate-800">{d.responsible}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Criticidade:</span>
                  <span className="font-semibold text-slate-800 capitalize">{d.criticality}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Serviços Vinculados:
                </span>
                <div className="flex flex-wrap gap-1">
                  {d.services.map((svc, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t pt-3 border-slate-100 flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-medium">✓ Renovação Automática</span>
              <button className="text-blue-600 hover:underline font-semibold cursor-pointer">
                Histórico de Renovação
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
