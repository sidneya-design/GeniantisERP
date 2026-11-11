import React from 'react';
import { Wrench, Plus, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

export const Maintenance: React.FC = () => {
  const maintenances = [
    {
      id: '1',
      patrimony: 'PAT-0042',
      equipment: 'Notebook Dell Latitude 3420',
      issue: 'Falha no teclado e desligamento intermitente após pico de energia.',
      opened_at: '2026-02-05',
      provider: 'Assistência Autorizada Dell',
      status: 'em_andamento',
      forecast_date: '2026-02-16',
      custody_note: 'Entrega anterior não encerrada silenciosamente (preserva vínculo original).',
    },
    {
      id: '2',
      patrimony: 'PAT-0012',
      equipment: 'Impressora HP LaserJet Pro M404',
      issue: 'Substituição do fusor e manutenção preventiva.',
      opened_at: '2026-01-20',
      provider: 'Técnico Interno TI',
      status: 'concluida',
      forecast_date: '2026-01-22',
      custody_note: 'Equipamento retornado ao estoque disponível.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manutenções de Equipamentos</h2>
          <p className="text-slate-500 text-sm mt-1">
            Controle operacional de ordens de serviço, assistências técnicas e previsão de retorno.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors">
            <Plus className="w-4 h-4" /> Abrir Chamado de Manutenção
          </button>
        </div>
      </div>

      {/* Grid de Manutenções */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {maintenances.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  {item.patrimony}
                </span>
                <h3 className="font-bold text-slate-800 text-base mt-1.5">{item.equipment}</h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  item.status === 'em_andamento'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {item.status === 'em_andamento' ? 'Em Reparo' : 'Concluída'}
              </span>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <strong>Defeito relatado:</strong> {item.issue}
            </p>

            <div className="text-xs space-y-1 text-slate-600 border-t pt-3 border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Responsável / Assistência:</span>
                <span className="font-medium text-slate-800">{item.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Abertura:</span>
                <span className="font-medium text-slate-800">
                  {new Date(item.opened_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Previsão de Conclusão:</span>
                <span className="font-semibold text-blue-700">
                  {new Date(item.forecast_date).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 italic border-t pt-2 border-slate-100">
              🛡️ {item.custody_note}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
