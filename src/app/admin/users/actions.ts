"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

const NO_KEY = "أضف SUPABASE_SERVICE_ROLE_KEY في ملف .env.local لتفعيل إدارة الحسابات";

export async function createStaffUser(input: { fullName: string; email: string; password: string; role: Role }): Promise<Result> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: NO_KEY };
  if (input.password.length < 8) return { ok: false, error: "كلمة المرور 8 أحرف على الأقل" };

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? "تعذر إنشاء الحساب" };

  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: input.fullName.trim(), role: input.role, is_active: true })
    .eq("id", data.user.id);
  if (pErr) return { ok: false, error: pErr.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetStaffPassword(userId: string, password: string): Promise<Result> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: NO_KEY };
  if (password.length < 8) return { ok: false, error: "كلمة المرور 8 أحرف على الأقل" };
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
