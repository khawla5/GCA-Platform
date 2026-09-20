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
  created_at: string;
  updated_at: string;
}

export type ProgramInput = Omit<Program, "id" | "created_at" | "updated_at">;

export type TrainerImport = Omit<Trainer, "created_at" | "updated_at">;
export type ProgramImport = Omit<Program, "created_at" | "updated_at">;

export interface AppState {
  role: Role | null;
  profile: Profile | null;
  trainers: Trainer[];
  programs: Program[];
  current: Program | null;
}
