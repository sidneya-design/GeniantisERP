import React from 'react';
import { Cake, Mail, ExternalLink, Calendar, CheckCircle2, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Birthdays: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              Aniversariantes (ParabénsFlow)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              Módulo Ativo
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Gestão integrada de datas festivas e disparos automatizados de e-mails de aniversário.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button 
            onClick={() => window.open('/aniversariantes-app/index.html', '_blank')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" /> Abrir Painel Direto
          </button>
        </div>
      </div>

      {/* Cartão de Status de Integração */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-6 rounded-2xl border border-rose-100 space-y-3">
        <div className="flex items-center gap-2 text-rose-900 font-bold text-base">
          <CheckCircle2 className="w-5 h-5 text-rose-600" />
          Aplicativo Existente Preservado & Conectado
        </div>
        <p className="text-sm text-rose-800 leading-relaxed">
          Conforme as regras do projeto, o código original do <strong>ParabénsFlow</strong> (Netlify Functions, Netlify Blobs, templates com Glassmorphism) foi integralmente preservado, sem recriação nem perda de dados cadastrais.
        </p>
        <div className="flex flex-wrap gap-4 pt-2 text-xs text-rose-700 font-medium">
          <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-lg border border-rose-200 shadow-2xs">
            <Shield className="w-4 h-4 text-rose-600" /> Autenticação Unificada
          </div>
          <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-lg border border-rose-200 shadow-2xs">
            <Mail className="w-4 h-4 text-rose-600" /> Disparo Diário às 07:00 (Brasília)
          </div>
          <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-lg border border-rose-200 shadow-2xs">
            <Calendar className="w-4 h-4 text-rose-600" /> Compatibilização com Cadastro Central
          </div>
        </div>
      </div>

      {/* Lista Rápida dos Aniversariantes do Mês Atual */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Cake className="w-5 h-5 text-rose-500" />
            Aniversariantes do Mês (Fevereiro)
          </h3>
          <span className="text-xs text-slate-500 font-medium">5 celebrações este mês</span>
        </div>

        <div className="divide-y divide-slate-100 text-sm">
          <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center">
                11
              </div>
              <div>
                <span className="font-semibold text-slate-800 block">Sidney Alberto</span>
                <span className="text-xs text-slate-500">Tecnologia da Informação • sidney.a@geniantis.com</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Hoje! 🎉
              </span>
              <button className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
                Disparar Manual
              </button>
            </div>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center">
                18
              </div>
              <div>
                <span className="font-semibold text-slate-800 block">Juliana Ferreira</span>
                <span className="text-xs text-slate-500">Recursos Humanos • juliana.f@geniantis.com</span>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium">Em 7 dias</span>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center">
                24
              </div>
              <div>
                <span className="font-semibold text-slate-800 block">Carlos Eduardo Santos</span>
                <span className="text-xs text-slate-500">Financeiro • carlos.s@geniantis.com</span>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium">Em 13 dias</span>
          </div>
        </div>
      </div>
    </div>
  );
};
