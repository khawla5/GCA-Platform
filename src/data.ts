import { supabase } from "./supabaseClient";
import type { Program, ProgramInput, Payment, PaymentInput, Trainer, TrainerInput, TrainerPayment, TrainerPaymentInput } from "./types";

export async function fetchTrainers(): Promise<Trainer[]> {
  const { data, error } = await supabase.from("trainers").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data as Trainer[]) ?? [];
}

export async function fetchPrograms(): Promise<Program[]> {
  const { data, error } = await supabase.from("programs").select("*").order("start_date", { ascending: false });
  if (error) throw error;
  return (data as Program[]) ?? [];
}

export async function upsertTrainer(id: string | null, input: TrainerInput): Promise<void> {
  const payload = { ...input, updated_at: new Date().toISOString() };
  const { error } = id ? await supabase.from("trainers").update(payload).eq("id", id) : await supabase.from("trainers").insert(payload);
  if (error) throw error;
}

export async function deleteTrainer(id: string): Promise<void> {
  const { error } = await supabase.from("trainers").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertProgram(id: string | null, input: ProgramInput): Promise<void> {
  const payload = { ...input, updated_at: new Date().toISOString() };
  const { error } = id ? await supabase.from("programs").update(payload).eq("id", id) : await supabase.from("programs").insert(payload);
  if (error) throw error;
}

export async function deleteProgram(id: string): Promise<void> {
  const { error } = await supabase.from("programs").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from("payments").select("*").order("program_name", { ascending: true });
  if (error) throw error;
  return (data as Payment[]) ?? [];
}

export async function upsertPayment(id: string | null, input: PaymentInput): Promise<void> {
  const payload = { ...input, updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabase.from("payments").update(payload).eq("id", id)
    : await supabase.from("payments").insert(payload);
  if (error) throw error;
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchTrainerPayments(): Promise<TrainerPayment[]> {
  const { data, error } = await supabase.from("trainer_payments").select("*").order("program_name", { ascending: true });
  if (error) throw error;
  return (data as TrainerPayment[]) ?? [];
}

export async function upsertTrainerPayment(id: string | null, input: TrainerPaymentInput): Promise<void> {
  const payload = { ...input, updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabase.from("trainer_payments").update(payload).eq("id", id)
    : await supabase.from("trainer_payments").insert(payload);
  if (error) throw error;
}

export async function deleteTrainerPayment(id: string): Promise<void> {
  const { error } = await supabase.from("trainer_payments").delete().eq("id", id);
  if (error) throw error;
}
