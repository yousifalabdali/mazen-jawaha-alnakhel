// إنشاء حساب مدير (يحتاج SUPABASE_SERVICE_ROLE_KEY في .env.local)
// الاستخدام: node --env-file=.env.local scripts/create-admin.mjs "الاسم" email@example.com "كلمة-المرور"
import { createClient } from "@supabase/supabase-js";

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
  console.error('الاستخدام: node --env-file=.env.local scripts/create-admin.mjs "الاسم" email "password"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("أضف NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env.local");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name },
});
if (error) {
  console.error("خطأ:", error.message);
  process.exit(1);
}
const { error: pErr } = await admin
  .from("profiles")
  .update({ full_name: name, role: "admin", is_active: true })
  .eq("id", data.user.id);
if (pErr) {
  console.error("خطأ:", pErr.message);
  process.exit(1);
}
console.log("✓ تم إنشاء المدير:", email);
