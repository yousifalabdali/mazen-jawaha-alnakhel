"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatMoney, roundMoney, round3, unitLabel } from "@/lib/money";
import type { Product } from "@/lib/types";
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader } from "@/components/ui";

export interface Movement {
  id: string;
  product_id: string;
  change: number;
  reason: "initial" | "sale" | "restock" | "adjust" | "void";
  note: string | null;
  created_at: string;
  invoice: { invoice_no: number } | null;
  user: { full_name: string } | null;
}

const REASON: Record<Movement["reason"], { label: string; tone: "ok" | "danger" | "mute" | "date" }> = {
  initial: { label: "رصيد افتتاحي", tone: "mute" },
  sale: { label: "بيع", tone: "date" },
  restock: { label: "توريد", tone: "ok" },
  adjust: { label: "تسوية جرد", tone: "mute" },
  void: { label: "إلغاء فاتورة", tone: "danger" },
};

export default function InventoryClient({
  products,
  movements,
  costs,
}: {
  products: Product[];
  movements: Movement[];
  costs: Record<string, number>;
}) {
  const router = useRouter();
  const [onlyLow, setOnlyLow] = useState(false);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<{ product: Product; mode: "restock" | "count" } | null>(null);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const isLow = (p: Product) => p.stock_qty <= p.low_stock_threshold;
  const list = products.filter((p) => (!onlyLow || isLow(p)) && (!q.trim() || p.name.includes(q.trim())));
  const lowCount = products.filter(isLow).length;
  const stockValue = roundMoney(products.reduce((s, p) => s + Math.max(p.stock_qty, 0) * (costs[p.id] ?? 0), 0));

  function open(product: Product, mode: "restock" | "count") {
    setTarget({ product, mode });
    setValue(mode === "count" ? String(round3(product.stock_qty)) : "");
    setNote("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    const v = Number(value);
    const change = target.mode === "restock" ? v : round3(v - target.product.stock_qty);
    if (!Number.isFinite(v) || (target.mode === "restock" && v <= 0)) {
      setError("أدخل كمية صحيحة");
      return;
    }
    if (change === 0) {
      setTarget(null);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("adjust_stock", {
      p_product_id: target.product.id,
      p_change: change,
      p_reason: target.mode === "restock" ? "restock" : "adjust",
      p_note: note,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTarget(null);
    router.refresh();
  }

  return (
    <>
      <PageHeader title="المخزون" subtitle="الوزن بالكيلو، والعلب والصواني بالحبة" />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-ink-mute">عدد المنتجات</div>
          <div className="num mt-1 text-2xl font-semibold">{products.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-ink-mute">منتجات ناقصة</div>
          <div className={`num mt-1 text-2xl font-semibold ${lowCount ? "text-danger" : ""}`}>{lowCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-ink-mute">قيمة المخزون بسعر التكلفة</div>
          <div className="mt-1 text-2xl font-semibold"><span className="num">{formatMoney(stockValue)}</span> <span className="text-sm font-normal text-ink-mute">ر.ع</span></div>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-56" />
        <Button variant={onlyLow ? "ink" : "outline"} size="sm" className="h-10" onClick={() => setOnlyLow((v) => !v)}>
          الناقص فقط
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line text-ink-mute">
              <tr>
                <th className="px-4 py-3 text-right font-medium">المنتج</th>
                <th className="px-4 py-3 text-right font-medium">الكمية الحالية</th>
                <th className="px-4 py-3 text-right font-medium">حد التنبيه</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={isLow(p) ? "danger" : "ok"}>
                      <span className="num">{round3(p.stock_qty)}</span>&nbsp;{unitLabel(p.sale_type)}
                    </Badge>
                  </td>
                  <td className="num px-4 py-2.5 text-ink-mute">{round3(p.low_stock_threshold)}</td>
                  <td className="px-4 py-2.5 text-left whitespace-nowrap">
                    <Button size="sm" variant="primary" onClick={() => open(p, "restock")}>+ توريد</Button>{" "}
                    <Button size="sm" variant="ghost" onClick={() => open(p, "count")}>جرد</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-display text-2xl">سجل الحركات</h2>
          <ul className="max-h-[560px] divide-y divide-line overflow-y-auto text-sm">
            {movements.map((m) => {
              const p = names[m.product_id];
              const r = REASON[m.reason];
              return (
                <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p?.name ?? "منتج محذوف"}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-mute">
                      <Badge tone={r.tone}>{r.label}</Badge>
                      {m.invoice && <span>فاتورة <span className="num">#{m.invoice.invoice_no}</span></span>}
                      {m.note && <span>· {m.note}</span>}
                      {m.user?.full_name && <span>· {m.user.full_name}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-mute">{formatDateTime(m.created_at)}</div>
                  </div>
                  <span className={`num shrink-0 font-semibold ${Number(m.change) < 0 ? "text-danger" : "text-ok"}`}>
                    {Number(m.change) > 0 ? "+" : ""}
                    {round3(Number(m.change))}
                  </span>
                </li>
              );
            })}
          </ul>
          {!movements.length && <p className="py-8 text-center text-ink-mute">لا توجد حركات</p>}
        </Card>
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? `${target.mode === "restock" ? "توريد" : "جرد"}: ${target.product.name}` : ""}>
        {target && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-ink-mute">
              الكمية الحالية: <span className="num font-semibold text-ink">{round3(target.product.stock_qty)}</span> {unitLabel(target.product.sale_type)}
            </p>
            <Field label={target.mode === "restock" ? `الكمية المضافة (${unitLabel(target.product.sale_type)})` : `الكمية الفعلية بعد الجرد (${unitLabel(target.product.sale_type)})`}>
              <Input autoFocus required type="number" step={target.product.sale_type === "weight" ? "0.001" : "1"} min={0} className="num" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            {target.mode === "count" && value !== "" && (
              <p className="text-sm text-ink-soft">
                الفرق: <span className="num font-semibold">{round3(Number(value) - target.product.stock_qty)}</span>
              </p>
            )}
            <Field label="ملاحظة (اختياري)">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={target.mode === "restock" ? "مثال: شحنة من المورد" : "مثال: جرد نهاية الشهر"} />
            </Field>
            <ErrorNote message={error} />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>حفظ</Button>
              <Button type="button" variant="ghost" onClick={() => setTarget(null)}>إلغاء</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
