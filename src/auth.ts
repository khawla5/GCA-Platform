import { supabase } from "./supabaseClient";
import type { Profile, Role } from "./types";

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("id, email, role").eq("id", user.id).single();

  if (error || !data) {
    return { id: user.id, email: user.email ?? null, role: "viewer" as Role };
  }
  return data as Profile;
}
