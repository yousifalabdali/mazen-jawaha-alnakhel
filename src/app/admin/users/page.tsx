import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";
import UsersClient from "./UsersClient";

export const metadata = { title: "المستخدمون — جوهرة النخيل" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("created_at");

  // البريد موجود في auth.users ويحتاج مفتاح الخدمة
  const emails: Record<string, string> = {};
  const admin = createAdminClient();
  if (admin) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    list?.users.forEach((u) => (emails[u.id] = u.email ?? ""));
  }

  return <UsersClient profiles={(data ?? []) as Profile[]} emails={emails} meId={me.id} hasServiceKey={!!admin} />;
}
