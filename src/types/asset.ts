export type AssetStatus = 'disponivel' | 'em_uso' | 'em_manutencao' | 'baixado';
export type AssetCondition = 'excelente' | 'bom' | 'regular' | 'ruim';

export interface Asset {
  id: string;
  patrimony: string;
  serial_number?: string;
  category: string;
  brand?: string;
  model?: string;
  unit: string;
  condition: AssetCondition;
  status: AssetStatus;
  assigned_employee_id?: string | null;
  assigned_to?: string | null;
  warranty_until?: string | null;
  acquisition_date?: string | null;
  purchase_cost?: number | null;
  // Só para computadores (Notebook, Desktop e Servidor)
  operating_system?: string | null;
  memory?: string | null;
  processor?: string | null;
  hostname?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
