"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyMenuChanged } from "@/lib/broadcast";
import type { Settings } from "@/lib/types";
import { Button, Card, ErrorNote, Field, Input, PageHeader, Switch, Textarea } from "@/components/ui";

export default function SettingsClient({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSaved(false);
    setS((x) => ({ ...x, [k]: v }));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { id, ...rest } = s;
    const { error } = await createClient()
      .from("settings")
      .update({
        ...rest,
        vat_number: rest.vat_number.trim(),
        vat_rate: Number(rest.vat_rate),
        display_rotate_seconds: Number(rest.display_rotate_seconds),
      })
      .eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    await notifyMenuChanged();
    setSaved(true);
    router.refresh();
  }

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="بيانات المحل كما تظهر في الفاتورة، وإعدادات الضريبة وشاشة العرض" />
      <form onSubmit={save} className="grid max-w-4xl gap-6">
        <Card className="grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-display text-2xl sm:col-span-2">بيانات المحل</h2>
          <Field label="اسم المحل"><Input value={s.shop_name} onChange={(e) => set("shop_name", e.target.value)} /></Field>
          <Field label="الوصف تحت الاسم"><Input value={s.shop_subtitle} onChange={(e) => set("shop_subtitle", e.target.value)} /></Field>
          <Field label="العنوان"><Input value={s.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="رقم الجوال"><Input dir="ltr" value={s.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="السجل التجاري"><Input dir="ltr" className="num" value={s.cr_number} onChange={(e) => set("cr_number", e.target.value)} /></Field>
          <Field label="تذييل الفاتورة"><Input value={s.invoice_footer} onChange={(e) => set("invoice_footer", e.target.value)} /></Field>
        </Card>

        <Card className="grid gap-4 p-6">
          <h2 className="font-display text-2xl">رسالة الواتساب</h2>
          <Field
            label="رسالة «الطلب جاهز» للزبون"
            hint="تُرسل عند الضغط على «جاهز» في صفحة الطلبات. الكلمات بين الأقواس تُستبدل تلقائياً: {الاسم} {الرقم} {المحل} {الإجمالي}"
          >
            <Textarea rows={3} value={s.whatsapp_ready_message} onChange={(e) => set("whatsapp_ready_message", e.target.value)} />
          </Field>
        </Card>

        <Card className="grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-display text-2xl sm:col-span-2">الضريبة</h2>
          <Field label="الرقم الضريبي" hint="مثال: OM1100000000. يظهر في الفاتورة عند تفعيل الضريبة">
            <Input dir="ltr" className="num" value={s.vat_number} onChange={(e) => set("vat_number", e.target.value)} />
          </Field>
          <Field label="نسبة الضريبة %">
            <Input type="number" min={0} max={100} step="0.001" className="num" value={s.vat_rate} onChange={(e) => set("vat_rate", e.target.value as unknown as number)} />
          </Field>
          <div className="space-y-3 sm:col-span-2">
            <Switch checked={s.vat_enabled_default} onChange={(v) => set("vat_enabled_default", v)} label="تفعيل الضريبة افتراضياً في الفواتير الجديدة (يمكن إيقافها لكل فاتورة من نقطة البيع)" />
            <Switch checked={s.prices_include_vat} onChange={(v) => set("prices_include_vat", v)} label="أسعار المنتجات شاملة الضريبة" />
            <p className="text-xs text-ink-mute">
              {s.prices_include_vat
                ? "السعر المعروض هو ما يدفعه العميل، والضريبة تُستخرج منه في الفاتورة."
                : "الضريبة تُضاف فوق سعر المنتج عند البيع."}
            </p>
          </div>
        </Card>

        <Card className="grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-display text-2xl sm:col-span-2">شاشة العرض</h2>
          <Field label="مدة عرض كل قسم (ثانية)">
            <Input type="number" min={4} max={120} className="num" value={s.display_rotate_seconds} onChange={(e) => set("display_rotate_seconds", e.target.value as unknown as number)} />
          </Field>
          <div className="flex items-end">
            <a href="/display" target="_blank" className="text-sm text-date hover:underline">فتح شاشة العرض ↗</a>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</Button>
          {saved && <span className="text-sm text-ok">تم الحفظ</span>}
        </div>
        <ErrorNote message={error} />
      </form>
    </>
  );
}
