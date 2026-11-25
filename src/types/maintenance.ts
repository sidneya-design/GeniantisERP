export type MaintenanceStatus = 'em_andamento' | 'concluida' | 'cancelada' | 'baixado';

export interface Maintenance {
  id: string;
  asset_id: string;
  patrimony: string;
  equipment: string;
  issue: string;
  opened_at: string;
  provider?: string | null;
  status: MaintenanceStatus;
  forecast_date?: string | null;
  completed_at?: string | null;
  cost?: number | null;
  invoice_file_path?: string | null;
  invoice_file_name?: string | null;
  notes?: string | null;
  custody_note?: string | null;
  created_at: string;
}
