"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyMenuChanged } from "@/lib/broadcast";
import { formatMoney, round3, unitLabel } from "@/lib/money";
import type { Category, Product, SaleType } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Switch, Textarea } from "@/components/ui";
import { DatePlaceholder } from "@/components/Logo";

interface Form {
  id?: string;
  name: string;
  category_id: string;
  sale_type: SaleType;
  price: string;
  cost: string;
  description: string;
  image_url: string | null;
  barcode: string;
  initial_stock: string;
  low_stock_threshold: string;
  sort_order: string;
  show_on_display: boolean;
  is_active: boolean;
}

const BUCKET_PREFIX = "/storage/v1/object/public/product-images/";

/** حذف صورة قديمة من التخزين (إن كانت من مخزن صور المنتجات) */
async function removeStoredImage(url: string | null) {
  if (!url || !url.includes(BUCKET_PREFIX)) return;
  const name = decodeURIComponent(url.split(BUCKET_PREFIX)[1] ?? "");
  if (name) await createClient().storage.from("product-images").remove([name]);
}

const empty = (catId: string): Form => ({
  name: "",
  category_id: catId,
  sale_type: "weight",
  price: "",
  cost: "",
  description: "",
  image_url: null,
  barcode: "",
  initial_stock: "",
  low_stock_threshold: "",
  sort_order: "0",
  show_on_display: true,
  is_active: true,
});

export default function ProductsClient({
  products,
  categories,
  costs,
}: {
  products: Product[];
  categories: Category[];
  costs: Record<string, number>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const list = products.filter((p) => (filter === "all" || p.category_id === filter) && (!q.trim() || p.name.includes(q.trim()) || p.barcode === q.trim()));

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  function openNew() {
    setError(null);
    setFile(null);
    setForm(empty(categories[0]?.id ?? ""));
  }

  function openEdit(p: Product) {
    setError(null);
    setFile(null);
    setForm({
      id: p.id,
      name: p.name,
      category_id: p.category_id ?? "",
      sale_type: p.sale_type,
      price: String(p.price),
      cost: costs[p.id] != null ? String(costs[p.id]) : "",
      description: p.description ?? "",
      image_url: p.image_url,
      barcode: p.barcode ?? "",
      initial_stock: "",
      low_stock_threshold: String(p.low_stock_threshold),
      sort_order: String(p.sort_order),
      show_on_display: p.show_on_display,
      is_active: p.is_active,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const price = Number(form.price);
    if (!form.name.trim() || !(price >= 0) || form.price === "") {
      setError("أدخل اسم المنتج والسعر");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();

    let image_url = form.image_url;
    if (file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) {
        setError("تعذر رفع الصورة: " + up.error.message);
        setBusy(false);
        return;
      }
      image_url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }

    const row = {
      name: form.name.trim(),
      category_id: form.category_id || null,
      sale_type: form.sale_type,
      price,
      description: form.description.trim() || null,
      image_url,
      barcode: form.barcode.trim() || null, // فارغ = توليد تلقائي
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
      sort_order: Number(form.sort_order) || 0,
      show_on_display: form.show_on_display,
      is_active: form.is_active,
    };

    let id = form.id;
    if (id) {
      const { error } = await supabase.from("products").update(row).eq("id", id);
      if (error) return fail(error.code === "23505" ? "هذا الباركود مستخدم لمنتج آخر" : error.message);
    } else {
      const { data, error } = await supabase.from("products").insert(row).select("id").single();
      if (error || !data) return fail(error?.code === "23505" ? "هذا الباركود مستخدم لمنتج آخر" : error?.message ?? "تعذر الحفظ");
      id = data.id as string;
      const initial = Number(form.initial_stock);
      if (initial > 0) {
        const r = await supabase.rpc("adjust_stock", { p_product_id: id, p_change: initial, p_reason: "initial", p_note: "رصيد افتتاحي" });
        if (r.error) return fail(r.error.message);
      }
    }

    const original = form.id ? products.find((p) => p.id === form.id)?.image_url ?? null : null;
    if (original && original !== image_url) await removeStoredImage(original);

    if (form.cost !== "") {
      const { error } = await supabase.from("product_costs").upsert({ product_id: id, cost_price: Number(form.cost) || 0 });
      if (error) return fail(error.message);
    }

    await notifyMenuChanged();
    setBusy(false);
    setForm(null);
    router.refresh();
  }

  function fail(msg: string) {
    setError(msg);
    setBusy(false);
  }

  async function remove(p: Product) {
    if (!confirm(`حذف "${p.name}" نهائياً؟\nالفواتير السابقة تبقى محفوظة. يمكنك بدلاً من ذلك إيقاف المنتج.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      alert("تعذر الحذف: " + error.message);
      return;
    }
    await removeStoredImage(p.image_url);
    await notifyMenuChanged();
    router.refresh();
  }

  async function toggleDisplay(p: Product) {
    const supabase = createClient();
    await supabase.from("products").update({ show_on_display: !p.show_on_display }).eq("id", p.id);
    await notifyMenuChanged();
    router.refresh();
  }

  const margin = form && form.cost !== "" && Number(form.price) > 0 ? ((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100 : null;

  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle={`${products.length} منتج`}
        actions={
          <>
            <Link
              href={`/admin/products/labels${selected.size ? `?ids=${[...selected].join(",")}` : ""}`}
              className="inline-flex h-10 items-center rounded-lg border border-line bg-card px-4 text-sm hover:border-ink-mute"
            >
              طباعة باركود{selected.size ? ` (${selected.size})` : ""}
            </Link>
            <Button onClick={openNew} disabled={!categories.length}>+ منتج جديد</Button>
          </>
        }
      />
      {!categories.length && <EmptyState>أضف قسماً أولاً من صفحة الأقسام</EmptyState>}

      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="بحث بالاسم أو الباركود…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-56" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-56">
          <option value="all">كل الأقسام</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-ink-mute">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="تحديد الكل"
                  className="accent-[var(--color-date)]"
                  checked={list.length > 0 && list.every((p) => selected.has(p.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(list.map((p) => p.id)) : new Set())}
                />
              </th>
              <th className="px-4 py-3 text-right font-medium">المنتج</th>
              <th className="px-4 py-3 text-right font-medium">القسم</th>
              <th className="px-4 py-3 text-right font-medium">السعر</th>
              <th className="px-4 py-3 text-right font-medium">التكلفة</th>
              <th className="px-4 py-3 text-right font-medium">المخزون</th>
              <th className="px-4 py-3 text-right font-medium">شاشة العرض</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((p) => (
              <tr key={p.id} className={p.is_active ? "" : "opacity-55"}>
                <td className="px-4 py-2.5">
                  <input type="checkbox" aria-label={`تحديد ${p.name}`} className="accent-[var(--color-date)]" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-14 shrink-0 overflow-hidden rounded-md bg-paper-deep">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <DatePlaceholder className="h-full w-full" />}
                    </div>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="num text-xs text-ink-mute">{p.barcode}</div>
                      {!p.is_active && <Badge>موقوف</Badge>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{p.category_id ? catName[p.category_id] : "—"}</td>
                <td className="px-4 py-2.5">
                  <span className="num font-semibold text-date">{formatMoney(p.price)}</span>
                  <span className="text-xs text-ink-mute"> / {unitLabel(p.sale_type)}</span>
                </td>
                <td className="num px-4 py-2.5 text-ink-soft">{costs[p.id] != null ? formatMoney(costs[p.id]) : "—"}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={p.stock_qty <= p.low_stock_threshold ? "danger" : "ok"}>
                    <span className="num">{round3(p.stock_qty)}</span>&nbsp;{unitLabel(p.sale_type)}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Switch checked={p.show_on_display} onChange={() => toggleDisplay(p)} label="" />
                </td>
                <td className="px-4 py-2.5 text-left whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>تعديل</Button>
                  <Button size="sm" variant="ghost" className="hover:text-danger!" onClick={() => remove(p)}>حذف</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="py-10 text-center text-ink-mute">لا توجد منتجات</p>}
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "تعديل منتج" : "منتج جديد"} wide>
        {form && (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-4">
              <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-paper-deep">
                {file ? (
                  <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                ) : form.image_url ? (
                  <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <DatePlaceholder className="h-full w-full" />
                )}
              </div>
              <div className="space-y-2 text-sm">
                <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-line bg-card px-3 hover:border-ink-mute">
                  اختر صورة
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                {(form.image_url || file) && (
                  <button type="button" className="block text-danger hover:underline cursor-pointer" onClick={() => { setFile(null); set("image_url", null); }}>
                    إزالة الصورة
                  </button>
                )}
                <p className="text-xs text-ink-mute">JPG أو PNG أو WEBP، حتى 5 ميجا</p>
              </div>
            </div>

            <Field label="اسم المنتج">
              <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="القسم">
              <Select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>

            <div className="sm:col-span-2">
              <Field
                label="الباركود"
                hint={form.sale_type === "weight" ? "اتركه فارغاً ليتولد تلقائياً. لملصقات الميزان اكتب رقم PLU من 5 أرقام (مثل 00012)" : "امسح باركود العلبة بالقارئ هنا، أو اتركه فارغاً ليتولد تلقائياً"}
              >
                <Input dir="ltr" className="num" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} placeholder="تلقائي" />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <span className="text-sm font-medium text-ink-soft">طريقة البيع</span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(["weight", "unit"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => set("sale_type", t)}
                    className={`h-11 rounded-lg border text-sm cursor-pointer ${form.sale_type === t ? "border-date bg-date-soft text-date font-medium" : "border-line bg-card text-ink-soft"}`}
                  >
                    {t === "weight" ? "بالوزن (سعر الكيلو)" : "بالحبة (علبة، صينية، بوكس)"}
                  </button>
                ))}
              </div>
            </div>

            <Field label={`سعر البيع (ر.ع / ${unitLabel(form.sale_type)})`}>
              <Input required type="number" min={0} step="0.001" className="num" value={form.price} onChange={(e) => set("price", e.target.value)} />
            </Field>
            <Field label="سعر التكلفة (اختياري)" hint={margin != null ? `هامش الربح ${margin.toFixed(1)}%` : "لا يظهر للكاشير"}>
              <Input type="number" min={0} step="0.001" className="num" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
            </Field>

            {!form.id && (
              <Field label={`الرصيد الافتتاحي (${unitLabel(form.sale_type)})`}>
                <Input type="number" min={0} step={form.sale_type === "weight" ? "0.001" : "1"} className="num" value={form.initial_stock} onChange={(e) => set("initial_stock", e.target.value)} />
              </Field>
            )}
            <Field label={`تنبيه عند نزول المخزون عن (${unitLabel(form.sale_type)})`}>
              <Input type="number" min={0} step="any" className="num" value={form.low_stock_threshold} onChange={(e) => set("low_stock_threshold", e.target.value)} />
            </Field>
            <Field label="الترتيب" hint="الأصغر يظهر أولاً">
              <Input type="number" className="num" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
            </Field>

            <div className="sm:col-span-2">
              <Field label="الوصف (يظهر في شاشة العرض)">
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>

            <div className="flex flex-wrap gap-6 sm:col-span-2">
              <Switch checked={form.show_on_display} onChange={(v) => set("show_on_display", v)} label="يظهر في شاشة العرض" />
              <Switch checked={form.is_active} onChange={(v) => set("is_active", v)} label="متاح للبيع" />
            </div>

            <div className="sm:col-span-2 space-y-3">
              <ErrorNote message={error} />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ"}</Button>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>إلغاء</Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
