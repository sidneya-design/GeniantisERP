import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, FileBarChart2, Laptop, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ModuleKey } from '../types';
import { EmployeeAssetsReport } from '../components/reports/EmployeeAssetsReport';
import { InventoryReport } from '../components/reports/InventoryReport';
import { WarrantyReport } from '../components/reports/WarrantyReport';

interface ReportDef {
  id: string;
  title: string;
  description: string;
  tag: string;
  /** Módulo que o perfil precisa poder ver para usar o relatório */
  module: ModuleKey;
  icon: React.ElementType;
  component: React.FC;
}

// Novos relatórios entram aqui
const REPORTS: ReportDef[] = [
  {
    id: 'itens-por-funcionario',
    title: 'Itens por funcionário',
    description: 'O que está com cada pessoa agora (patrimônio, série, data de entrega e termo) e o histórico de entregas e devoluções. Imprime ou exporta para Excel.',
    tag: 'Ativos',
    module: 'movements',
    icon: Users,
    component: EmployeeAssetsReport,
  },
  {
    id: 'inventario',
    title: 'Inventário de ativos',
    description: 'Todos os equipamentos com filtro por categoria, situação e unidade: patrimônio, série, responsável, aquisição, custo e garantia.',
    tag: 'Ativos',
    module: 'assets',
    icon: Laptop,
    component: InventoryReport,
  },
  {
    id: 'garantias',
    title: 'Garantias vencendo',
    description: 'Ativos com garantia acabando nos próximos 30, 60, 90, 180 ou 365 dias, e as já vencidas.',
    tag: 'Ativos',
    module: 'assets',
    icon: ShieldCheck,
    component: WarrantyReport,
  },
];

export const Reports: React.FC = () => {
  const { canAccess } = useAuth();
  const available = useMemo(() => REPORTS.filter((r) => canAccess(r.module)), [canAccess]);
  const [activeId, setActiveId] = useState<string | null>(available.length === 1 ? available[0].id : null);
  const active = available.find((r) => r.id === activeId) || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileBarChart2 className="w-6 h-6 text-blue-600" /> Relatórios
          </h2>
          <p className="text-slate-500 text-sm mt-1">Consultas prontas para imprimir ou exportar para Excel.</p>
        </div>
      </div>

      {!active && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {available.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveId(r.id)}
              className="text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all flex gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <r.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.tag}</span>
                <h3 className="font-bold text-slate-800 mt-1.5">{r.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{r.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 self-center" />
            </button>
          ))}
          {!available.length && (
            <p className="text-sm text-slate-500">Nenhum relatório disponível para o seu perfil.</p>
          )}
        </div>
      )}

      {active && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            {available.length > 1 && (
              <button type="button" onClick={() => setActiveId(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Voltar aos relatórios">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <active.icon className="w-5 h-5 text-blue-600" /> {active.title}
            </h3>
          </div>
          <active.component />
        </div>
      )}
    </div>
  );
};
