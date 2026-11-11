export type MovementType = 'entrega' | 'devolucao';
export type MovementTermStatus = 'pendente' | 'assinado';

export interface MovementAsset {
  id: string;
  patrimony: string;
  description?: string;
}

export interface Movement {
  id: string;
  employee_id: string;
  employee_name: string;
  type: MovementType;
  asset_ids: string[];
  items: MovementAsset[];
  movement_date: string;
  term_status: MovementTermStatus;
  notes?: string | null;
  term_file_path?: string | null;
  term_file_name?: string | null;
  user_in_charge?: string | null;
  created_at: string;
}
