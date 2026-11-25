export type SupplierCategory =
  | 'telefonia'
  | 'internet'
  | 'seguranca'
  | 'software'
  | 'manutencao'
  | 'impressao'
  | 'hardware'
  | 'servicos'
  | 'outros';

export const SUPPLIER_CATEGORY_LABEL: Record<SupplierCategory, string> = {
  telefonia: 'Telefonia',
  internet: 'Internet / Link',
  seguranca: 'Segurança e câmeras',
  software: 'Software e licenças',
  manutencao: 'Manutenção / Assistência',
  impressao: 'Impressão',
  hardware: 'Hardware',
  servicos: 'Serviços gerais',
  outros: 'Outros',
};

export type SupplierStatus = 'ativo' | 'inativo';

export interface SupplierContact {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface Supplier {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  category: SupplierCategory;
  status: SupplierStatus;
  phone: string | null;
  email: string | null;
  website: string | null;
  support_phone: string | null;
  support_email: string | null;
  support_url: string | null;
  customer_number: string | null;
  contacts: SupplierContact[];
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SupplierInput = Omit<Supplier, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export type ContractStatus = 'vigente' | 'encerrado' | 'cancelado';

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  vigente: 'Vigente',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

export interface SupplierContract {
  id: string;
  supplier_id: string;
  name: string;
  contract_number: string | null;
  start_date: string | null;
  end_date: string | null;
  monthly_amount: number;
  billing_day: number | null;
  auto_renew: boolean;
  notice_days: number | null;
  readjustment: string | null;
  penalty: string | null;
  status: ContractStatus;
  file_path: string | null;
  file_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SupplierContractInput = Omit<SupplierContract, 'id' | 'created_at' | 'updated_at'> & { id?: string };
