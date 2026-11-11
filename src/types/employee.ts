export type EmployeeStatus = 'ativo' | 'afastado' | 'desligado';

export interface Employee {
  id: string;
  registration_number?: string; // Matrícula opcional
  full_name: string;
  preferential_name?: string;
  email: string; // E-mail corporativo
  phone?: string; // Telefone corporativo
  department: string;
  role_title: string;
  unit: string;
  manager?: string;
  admission_date: string;
  termination_date?: string | null;
  birth_date?: string; // Data de nascimento / Aniversário (YYYY-MM-DD)
  status: EmployeeStatus;
  photo_url?: string;
  restricted_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithRelations extends Employee {
  assets_count?: number;
  licenses_count?: number;
}
