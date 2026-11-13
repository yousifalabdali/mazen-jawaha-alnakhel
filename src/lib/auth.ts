import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

export async function requireStaff(): Promise<Profile> {
  const p = await getProfile();
  if (!p || !p.is_active) redirect("/login");
  return p;
}

export async function requireAdmin(): Promise<Profile> {
  const p = await requireStaff();
  if (p.role !== "admin") redirect("/pos");
  return p;
}
