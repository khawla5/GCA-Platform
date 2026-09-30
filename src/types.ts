export type Role = "admin" | "viewer";

export interface Profile {
  id: string;
  email: string | null;
  role: Role;
}

export interface Trainer {
  id: string;
  name: string;
  specialty: string | null;
  qualification: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  city: string | null;
  notes: string | null;
  cv_url: string | null;
  created_at: string;
  updated_at: string;
}

export type TrainerInput = Omit<Trainer, "id" | "created_at" | "updated_at">;

export interface Program {
  id: string;
  ref: string | null;
  title: string;
  type: string | null;
  trainer_id: string | null;
  mode: string | null;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  hours: number | null;
  location: string | null;
  target_group: string | null;
  participants: number | null;
  gca_contact: string | null;
  status_gca: string;
  status_trainer: string;
  notes: string | null;
  contract_value: number | null;
  created_at: string;
  updated_at: string;
}

export type ProgramInput = Omit<Program, "id" | "created_at" | "updated_at">;

// دفعة واحدة من دفعات عقد البرنامج — برنامج واحد يقدر ياخذ أكثر من دفعة
export interface ProgramPayment {
  id: string;
  program_id: string;
  due_portion: string | null;
  entitlement_percent: number | null;
  entitlement_value: number | null;
  due_date: string | null;
  payment_status: string;
  coc_number: string | null;
  invoice_number: string | null;
  created_at: string;
  updated_at: string;
}

export type ProgramPaymentInput = Omit<ProgramPayment, "id" | "created_at" | "updated_at">;

export interface Payment {
  id: string;
  purchase_order: string | null;
  installments_total: number;
  installments_paid: number;
  program_name: string;
  contract_value: number | null;
  due_portion: string | null;
  entitlement_value: number | null;
  due_date: string | null;
  status: string;
  coc_number: string | null;
  invoice_number: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentInput = Omit<Payment, "id" | "created_at" | "updated_at">;

export interface TrainerPayment {
  id: string;
  program_name: string;
  track: string | null;
  trainer_id: string | null;
  due_portion: string | null;
  entitlement_percent: number | null;
  due_date: string | null;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

export type TrainerPaymentInput = Omit<TrainerPayment, "id" | "created_at" | "updated_at">;

export interface AppState {
  role: Role | null;
  profile: Profile | null;
  trainers: Trainer[];
  programs: Program[];
  programPayments: ProgramPayment[];
  payments: Payment[];
  trainerPayments: TrainerPayment[];
  current: Program | null;
}
