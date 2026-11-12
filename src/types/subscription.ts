export type SubscriptionStatus = 'ativa' | 'suspensa' | 'cancelada';
export type SubscriptionPeriodicity = 'mensal' | 'anual' | 'anual_pago_mensalmente';
export type SubscriptionBillingType = 'por_usuario' | 'fixo';

export interface Subscription {
  id: string;
  service_name: string;
  provider: string | null;
  category: string | null;
  billing_type: SubscriptionBillingType;
  periodicity: SubscriptionPeriodicity;
  amount: number;
  total_licenses: number;
  renewal_date: string | null;
  billing_day: number | null;
  auto_renew: boolean;
  status: SubscriptionStatus;
  admin_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionInput = Omit<Subscription, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export interface SubscriptionAssignment {
  id: string;
  subscription_id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_department: string | null;
  employee_status: string | null;
  assigned_at: string;
  notes: string | null;
}
