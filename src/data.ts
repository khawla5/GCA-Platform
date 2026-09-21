import { supabase } from "./supabaseClient";
import type { Program, ProgramImport, ProgramInput, ProjectPayment, ProjectPaymentInput, Trainer, TrainerImport, TrainerInput } from "./types";

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

export async function replaceAllData(trainers: TrainerImport[], programs: ProgramImport[]): Promise<void> {
  const { error: delP } = await supabase.from("programs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delP) throw delP;
  const { error: delT } = await supabase.from("trainers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delT) throw delT;

  if (trainers.length) {
    const { error } = await supabase.from("trainers").insert(trainers);
    if (error) throw error;
  }
  if (programs.length) {
    const { error } = await supabase.from("programs").insert(programs);
    if (error) throw error;
  }
}

export async function resetAllData(): Promise<void> {
  const { error: delP } = await supabase.from("programs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delP) throw delP;
  const { error: delT } = await supabase.from("trainers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delT) throw delT;
}

export async function fetchProjectPayments(): Promise<ProjectPayment[]> {
  const { data, error } = await supabase.from("project_payments").select("*").order("program_name", { ascending: true });
  if (error) throw error;
  return (data as ProjectPayment[]) ?? [];
}

export async function upsertProjectPayment(id: string | null, input: ProjectPaymentInput): Promise<void> {
  const payload = { ...input, updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabase.from("project_payments").update(payload).eq("id", id)
    : await supabase.from("project_payments").insert(payload);
  if (error) throw error;
}

export async function deleteProjectPayment(id: string): Promise<void> {
  const { error } = await supabase.from("project_payments").delete().eq("id", id);
  if (error) throw error;
}
