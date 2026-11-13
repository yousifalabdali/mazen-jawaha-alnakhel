"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyMenuChanged } from "@/lib/broadcast";
import type { Category } from "@/lib/types";
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Switch } from "@/components/ui";

interface Form {
  id?: string;
  name: string;
  sort_order: string;
  is_active: boolean;
}

export default function CategoriesClient({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form?.name.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const row = { name: form.name.trim(), sort_order: Number(form.sort_order) || 0, is_active: form.is_active };
    const { error } = form.id
      ? await supabase.from("categories").update(row).eq("id", form.id)
      : await supabase.from("categories").insert(row);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    await notifyMenuChanged();
    setForm(null);
    router.refresh();
  }

  async function remove(c: Category) {
    if ((counts[c.id] ?? 0) > 0) {
      alert("لا يمكن حذف قسم فيه منتجات. انقل المنتجات أو أوقف القسم.");
      return;
    }
    if (!confirm(`حذف قسم "${c.name}"؟`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) alert(error.message);
    await notifyMenuChanged();
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="الأقسام"
        subtitle="ترتيب الأقسام هنا هو ترتيبها في نقطة البيع وشاشة العرض"
        actions={<Button onClick={() => { setError(null); setForm({ name: "", sort_order: String(categories.length + 1), is_active: true }); }}>+ قسم جديد</Button>}
      />
      <Card className="max-w-3xl">
        <ul className="divide-y divide-line">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-5 py-3.5">
              <span className="num flex h-8 w-8 items-center justify-center rounded-full bg-paper-deep text-sm text-ink-soft">{c.sort_order}</span>
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-ink-mute"><span className="num">{counts[c.id] ?? 0}</span> منتج</div>
              </div>
              {!c.is_active && <Badge>موقوف</Badge>}
              <Button size="sm" variant="ghost" onClick={() => { setError(null); setForm({ id: c.id, name: c.name, sort_order: String(c.sort_order), is_active: c.is_active }); }}>تعديل</Button>
              <Button size="sm" variant="ghost" className="hover:text-danger!" onClick={() => remove(c)}>حذف</Button>
            </li>
          ))}
        </ul>
        {!categories.length && <p className="py-10 text-center text-ink-mute">لا توجد أقسام</p>}
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "تعديل قسم" : "قسم جديد"}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="اسم القسم">
              <Input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="الترتيب">
              <Input type="number" className="num" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </Field>
            <Switch checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="القسم مفعّل" />
            <ErrorNote message={error} />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>حفظ</Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>إلغاء</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
