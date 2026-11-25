export type MovementType = 'entrega' | 'devolucao';
// nao_utiliza: itens que dispensam termo (periféricos, mouse etc.)
export type MovementTermStatus = 'pendente' | 'assinado' | 'nao_utiliza';

export const TERM_STATUS_LABEL: Record<MovementTermStatus, string> = {
  pendente: 'Pendente',
  assinado: 'Assinado',
  nao_utiliza: 'Não utiliza termo',
};

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
  term_emailed_at?: string | null;
  term_emailed_to?: string | null;
  user_in_charge?: string | null;
  created_at: string;
}
