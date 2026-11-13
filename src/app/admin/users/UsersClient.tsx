"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Role } from "@/lib/types";
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { createStaffUser, resetStaffPassword } from "./actions";

export default function UsersClient({
  profiles,
  emails,
  meId,
  hasServiceKey,
}: {
  profiles: Profile[];
  emails: Record<string, string>;
  meId: string;
  hasServiceKey: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "cashier" as Role });
  const [resetFor, setResetFor] = useState<Profile | null>(null);
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await createStaffUser(form);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setAdding(false);
    setForm({ fullName: "", email: "", password: "", role: "cashier" });
    router.refresh();
  }

  async function update(p: Profile, patch: Partial<Profile>) {
    const { error } = await createClient().from("profiles").update(patch).eq("id", p.id);
    if (error) alert(error.message);
    router.refresh();
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    setBusy(true);
    setError(null);
    const r = await resetStaffPassword(resetFor.id, newPass);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResetFor(null);
    setNewPass("");
  }

  return (
    <>
      <PageHeader
        title="المستخدمون"
        subtitle="المدير يرى كل شيء، والكاشير يبيع ويطبع فقط"
        actions={<Button onClick={() => { setError(null); setAdding(true); }} disabled={!hasServiceKey}>+ مستخدم جديد</Button>}
      />
      {!hasServiceKey && (
        <p className="mb-4 max-w-3xl rounded-lg bg-date-soft px-4 py-3 text-sm text-date">
          لإضافة حسابات جديدة أو تغيير كلمات المرور، انسخ مفتاح <b dir="ltr">service_role</b> من لوحة Supabase (Project Settings ← API Keys) وضعه في ملف <b dir="ltr">.env.local</b> ثم أعد تشغيل الخادم.
        </p>
      )}

      <Card className="max-w-4xl overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-ink-mute">
            <tr>
              <th className="px-4 py-3 text-right font-medium">الاسم</th>
              <th className="px-4 py-3 text-right font-medium">البريد</th>
              <th className="px-4 py-3 text-right font-medium">الصلاحية</th>
              <th className="px-4 py-3 text-right font-medium">الحالة</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {profiles.map((p) => {
              const me = p.id === meId;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 font-medium">{p.full_name || "—"} {me && <Badge tone="date">أنت</Badge>}</td>
                  <td className="px-4 py-2.5 text-ink-soft" dir="ltr">{emails[p.id] ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Select value={p.role} disabled={me} onChange={(e) => update(p, { role: e.target.value as Role })} className="h-8 w-28">
                      <option value="cashier">كاشير</option>
                      <option value="admin">مدير</option>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={p.is_active ? "ok" : "mute"}>{p.is_active ? "مفعّل" : "معطّل"}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-left whitespace-nowrap">
                    {!me && (
                      <Button size="sm" variant="ghost" onClick={() => update(p, { is_active: !p.is_active })}>
                        {p.is_active ? "تعطيل" : "تفعيل"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={!hasServiceKey} onClick={() => { setError(null); setResetFor(p); }}>
                      كلمة المرور
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="مستخدم جديد">
        <form onSubmit={add} className="space-y-4">
          <Field label="الاسم">
            <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </Field>
          <Field label="البريد الإلكتروني" hint="يُستخدم لتسجيل الدخول فقط">
            <Input required type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="كلمة المرور" hint="8 أحرف على الأقل">
            <Input required minLength={8} type="text" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="الصلاحية">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="cashier">كاشير</option>
              <option value="admin">مدير</option>
            </Select>
          </Field>
          <ErrorNote message={error} />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>إنشاء</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>إلغاء</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`كلمة مرور جديدة: ${resetFor?.full_name ?? ""}`}>
        <form onSubmit={reset} className="space-y-4">
          <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل">
            <Input autoFocus required minLength={8} dir="ltr" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          </Field>
          <ErrorNote message={error} />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>حفظ</Button>
            <Button type="button" variant="ghost" onClick={() => setResetFor(null)}>إلغاء</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
