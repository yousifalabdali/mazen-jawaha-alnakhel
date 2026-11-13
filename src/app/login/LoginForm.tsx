"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setError("البريد أو كلمة المرور غير صحيحة");
      setBusy(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", data.user.id).single();
    if (!profile?.is_active) {
      await supabase.auth.signOut();
      setError("هذا الحساب غير مفعّل، تواصل مع المدير");
      setBusy(false);
      return;
    }
    router.replace(profile.role === "admin" ? "/admin" : "/pos");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <Field label="البريد الإلكتروني">
        <Input type="email" dir="ltr" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="كلمة المرور">
        <Input type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <ErrorNote message={error} />
      <Button type="submit" variant="ink" size="lg" className="w-full" disabled={busy}>
        {busy ? "جارٍ الدخول…" : "دخول"}
      </Button>
    </form>
  );
}
