"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { computeTotals, formatMoney, formatQty, roundMoney, round3, unitLabel } from "@/lib/money";
import type { Category, PaymentMethod, Product, Profile, Settings } from "@/lib/types";
import { Button, ErrorNote, Input, Modal, Switch } from "@/components/ui";
import { DatePlaceholder, Logo } from "@/components/Logo";
import { beep, resolveBarcode } from "@/lib/barcode";

interface Line {
  key: string;
  product: Product;
  qty: number; // كيلو أو عدد
}

const QUICK_WEIGHTS = [0.25, 0.5, 0.75, 1, 2];

export default function PosClient({
  profile,
  categories,
  products,
  settings,
}: {
  profile: Profile;
  categories: Category[];
  products: Product[];
  settings: Settings;
}) {
  const [activeCat, setActiveCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [vatEnabled, setVatEnabled] = useState(settings.vat_enabled_default);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paid, setPaid] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [weighing, setWeighing] = useState<{ product: Product; lineKey?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; no: number; total: number; change: number } | null>(null);
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const scanBuf = useRef<{ chars: string; last: number }>({ chars: "", last: 0 });

  const visible = useMemo(() => {
    const q = query.trim();
    return products.filter(
      (p) => (activeCat === "all" || p.category_id === activeCat) && (!q || p.name.includes(q) || p.barcode === q),
    );
  }, [products, activeCat, query]);

  const totals = computeTotals({
    lines: lines.map((l) => ({ qty: l.qty, price: l.product.price })),
    discount: Number(discount) || 0,
    vatEnabled,
    vatRate: Number(settings.vat_rate),
    pricesIncludeVat: settings.prices_include_vat,
  });
  const paidNum = method === "cash" ? (paid === "" ? totals.total : Number(paid)) : totals.total;
  const change = roundMoney(paidNum - totals.total);

  function onProductClick(p: Product) {
    if (p.sale_type === "weight") {
      setWeighing({ product: p });
      return;
    }
    setLines((ls) => {
      const existing = ls.find((l) => l.product.id === p.id);
      if (existing) return ls.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key: crypto.randomUUID(), product: p, qty: 1 }];
    });
  }

  function addWeighed(product: Product, kg: number) {
    setLines((ls) => [...ls, { key: crypto.randomUUID(), product, qty: round3(kg) }]);
  }

  /** معالجة كود من قارئ الباركود */
  const handleScan = useCallback(
    (code: string) => {
      const r = resolveBarcode(code, products);
      if (r.kind === "unknown") {
        beep(false);
        setScanMsg({ ok: false, text: `باركود غير معروف: ${r.code}` });
        return;
      }
      beep(true);
      if (r.kind === "weighed") {
        addWeighed(r.product, r.kg);
        setScanMsg({ ok: true, text: `${r.product.name} — ${formatQty(r.kg, "weight")}` });
      } else {
        onProductClick(r.product);
        setScanMsg({ ok: true, text: r.product.name });
      }
    },
    [products],
  );

  // القارئ يعمل كلوحة مفاتيح: أحرف سريعة متتالية ثم Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") && !el.dataset.scan;
      if (typing || weighing) return;
      const now = performance.now();
      const buf = scanBuf.current;
      if (now - buf.last > 80) buf.chars = "";
      buf.last = now;
      if (e.key === "Enter") {
        if (buf.chars.length >= 3) {
          e.preventDefault();
          handleScan(buf.chars);
        }
        buf.chars = "";
      } else if (e.key.length === 1) {
        buf.chars += e.key;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleScan, weighing]);

  useEffect(() => {
    if (!scanMsg) return;
    const t = setTimeout(() => setScanMsg(null), 2500);
    return () => clearTimeout(t);
  }, [scanMsg]);

  function setWeight(kg: number) {
    if (!weighing || kg <= 0) return;
    const { product, lineKey } = weighing;
    setLines((ls) =>
      lineKey
        ? ls.map((l) => (l.key === lineKey ? { ...l, qty: round3(kg) } : l))
        : [...ls, { key: crypto.randomUUID(), product, qty: round3(kg) }],
    );
    setWeighing(null);
  }

  function changeUnit(key: string, delta: number) {
    setLines((ls) => ls.flatMap((l) => (l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }])));
  }

  function reset() {
    setLines([]);
    setDiscount("");
    setPaid("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerOpen(false);
    setMethod("cash");
    setVatEnabled(settings.vat_enabled_default);
    setError(null);
  }

  async function save() {
    setError(null);
    if (!lines.length) return;
    if (method === "cash" && paidNum < totals.total) {
      setError("المبلغ المدفوع أقل من الإجمالي");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_invoice", {
      payload: {
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        discount: totals.discount,
        vat_enabled: vatEnabled,
        payment_method: method,
        paid_amount: method === "cash" ? paidNum : null,
        customer_name: customerName,
        customer_phone: customerPhone,
      },
    });
    if (error || !data) {
      setError(error?.message ?? "تعذر حفظ الفاتورة");
      setBusy(false);
      return;
    }
    const { data: inv } = await supabase.from("invoices").select("invoice_no,total,change_amount").eq("id", data).single();
    setSaved({ id: data as string, no: inv?.invoice_no ?? 0, total: Number(inv?.total ?? totals.total), change: Number(inv?.change_amount ?? 0) });
    setBusy(false);
    reset();
  }

  const openPrint = (id: string, size: "80mm" | "a4") => window.open(`/invoices/${id}/print?size=${size}`, "_blank");

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {/* الشريط العلوي */}
      <header className="flex h-16 shrink-0 items-center justify-between bg-ink px-5 text-paper">
        <div className="flex items-center gap-3">
          <Logo variant="light" size={34} />
          <div className="leading-tight">
            <div className="font-display text-xl">{settings.shop_name}</div>
            <div className="text-xs text-paper/60">نقطة البيع</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden text-paper/70 sm:inline">{profile.full_name || "الكاشير"}</span>
          {profile.role === "admin" && (
            <Link href="/admin" className="rounded-lg px-3 py-1.5 text-paper/85 hover:bg-white/10">
              لوحة الإدارة
            </Link>
          )}
          <form action="/logout" method="post">
            <button className="rounded-lg px-3 py-1.5 text-paper/85 hover:bg-white/10 cursor-pointer">خروج</button>
          </form>
        </div>
      </header>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[1fr_420px]">
        {/* المنتجات */}
        <section className="flex flex-col p-5 lg:min-h-0">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="ابحث أو امسح الباركود…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !query.trim()) return;
                const code = query.trim();
                if (resolveBarcode(code, products).kind !== "unknown") {
                  e.preventDefault();
                  handleScan(code);
                  setQuery("");
                }
              }}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {[{ id: "all", name: "الكل" }, ...categories].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`h-10 rounded-full px-4 text-sm transition-colors cursor-pointer ${
                    activeCat === c.id ? "bg-ink text-paper" : "bg-card text-ink-soft border border-line hover:border-ink-mute"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid auto-rows-max grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 pb-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] lg:overflow-y-auto">
            {visible.map((p) => {
              const low = p.stock_qty <= p.low_stock_threshold;
              return (
                <button
                  key={p.id}
                  onClick={() => onProductClick(p)}
                  className="group overflow-hidden rounded-xl border border-line bg-card text-right transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md cursor-pointer"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-paper-deep">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <DatePlaceholder className="h-full w-full" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 font-medium text-ink">{p.name}</div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-date font-semibold">
                        <span className="num">{formatMoney(p.price)}</span> <span className="text-xs font-normal text-ink-mute">ر.ع / {unitLabel(p.sale_type)}</span>
                      </span>
                    </div>
                    {low && (
                      <div className="mt-1 text-xs text-danger">
                        المخزون: <span className="num">{round3(p.stock_qty)}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            {!visible.length && <p className="col-span-full py-16 text-center text-ink-mute">لا توجد منتجات</p>}
          </div>
        </section>

        {/* السلة */}
        <aside className="flex flex-col border-t border-line bg-card lg:min-h-0 lg:border-t-0 lg:border-r">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-display text-2xl">الفاتورة</h2>
            {lines.length > 0 && (
              <button onClick={reset} className="text-sm text-ink-mute hover:text-danger cursor-pointer">
                تفريغ
              </button>
            )}
          </div>

          <div className="px-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {!lines.length && <p className="py-12 text-center text-sm text-ink-mute">اختر المنتجات لإضافتها للفاتورة</p>}
            <ul className="divide-y divide-line">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.product.name}</div>
                    <div className="text-xs text-ink-mute">
                      <span className="num">{formatMoney(l.product.price)}</span> ر.ع / {unitLabel(l.product.sale_type)}
                    </div>
                  </div>
                  {l.product.sale_type === "unit" ? (
                    <div className="flex items-center rounded-lg border border-line">
                      <button className="h-8 w-8 text-lg cursor-pointer hover:bg-paper-deep" onClick={() => changeUnit(l.key, 1)} aria-label="زيادة">+</button>
                      <span className="num w-8 text-center">{l.qty}</span>
                      <button className="h-8 w-8 text-lg cursor-pointer hover:bg-paper-deep" onClick={() => changeUnit(l.key, -1)} aria-label="إنقاص">−</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setWeighing({ product: l.product, lineKey: l.key })}
                      className="rounded-lg border border-line px-2.5 py-1 text-sm hover:border-gold cursor-pointer"
                    >
                      {formatQty(l.qty, "weight")}
                    </button>
                  )}
                  <div className="num w-20 text-left font-semibold">{formatMoney(roundMoney(l.qty * l.product.price))}</div>
                  <button
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    className="text-ink-mute hover:text-danger cursor-pointer"
                    aria-label="حذف"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 border-t border-line bg-paper/60 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <Switch checked={vatEnabled} onChange={setVatEnabled} label={`الضريبة ${Number(settings.vat_rate)}%`} />
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                خصم
                <Input type="number" min={0} step="0.001" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className="num h-9 w-24" placeholder="0.000" />
              </label>
            </div>

            <button onClick={() => setCustomerOpen((v) => !v)} className="text-sm text-date hover:underline cursor-pointer">
              {customerOpen ? "إخفاء بيانات العميل" : "+ بيانات العميل (اختياري)"}
            </button>
            {customerOpen && (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <Input placeholder="الجوال" dir="ltr" inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
            )}

            <dl className="space-y-1 text-sm">
              <Row label="المجموع" value={totals.subtotal} />
              {totals.discount > 0 && <Row label="الخصم" value={-totals.discount} />}
              {vatEnabled && (
                <>
                  <Row label="الإجمالي قبل الضريبة" value={totals.taxable} />
                  <Row label={`الضريبة ${Number(settings.vat_rate)}%`} value={totals.vat} />
                </>
              )}
            </dl>
            <div className="flex items-baseline justify-between rounded-xl bg-ink px-4 py-3 text-paper">
              <span className="font-display text-xl">الإجمالي</span>
              <span className="text-2xl font-semibold">
                <span className="num">{formatMoney(totals.total)}</span> <span className="text-sm font-normal text-paper/70">ر.ع</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["cash", "card"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`h-11 rounded-lg border text-sm font-medium transition cursor-pointer ${
                    method === m ? "border-date bg-date-soft text-date" : "border-line bg-card text-ink-soft hover:border-ink-mute"
                  }`}
                >
                  {m === "cash" ? "كاش" : "شبكة (مدى / فيزا)"}
                </button>
              ))}
            </div>

            {method === "cash" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-soft">المدفوع</span>
                  <Input type="number" min={0} step="0.001" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={formatMoney(totals.total)} className="num h-9 flex-1" />
                  <span className={`num min-w-24 text-left text-sm font-semibold ${change < 0 ? "text-danger" : "text-ok"}`}>
                    الباقي {formatMoney(Math.max(change, 0))}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 5, 10, 20, 50].map((v) => (
                    <button key={v} onClick={() => setPaid(String(v))} className="num h-8 flex-1 rounded-md border border-line bg-card text-sm hover:border-gold cursor-pointer">
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ErrorNote message={error} />
            <Button size="lg" className="w-full" disabled={!lines.length || busy} onClick={save}>
              {busy ? "جارٍ الحفظ…" : "حفظ الفاتورة"}
            </Button>
          </div>
        </aside>
      </div>

      {scanMsg && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${scanMsg.ok ? "bg-ink text-paper" : "bg-danger text-paper"}`}
        >
          {scanMsg.ok ? "✓ " : ""}
          {scanMsg.text}
        </div>
      )}

      {weighing && <WeightModal product={weighing.product} onClose={() => setWeighing(null)} onConfirm={setWeight} />}

      <Modal open={!!saved} onClose={() => setSaved(null)} title="تم حفظ الفاتورة">
        {saved && (
          <div className="space-y-5">
            <div className="rounded-xl bg-paper px-4 py-3 text-center">
              <div className="text-sm text-ink-mute">فاتورة رقم</div>
              <div className="num text-3xl font-semibold">{saved.no}</div>
              <div className="mt-2 text-ink-soft">
                الإجمالي <span className="num font-semibold">{formatMoney(saved.total)}</span> ر.ع
                {saved.change > 0 && (
                  <>
                    {" "}· الباقي للعميل <span className="num font-semibold text-ok">{formatMoney(saved.change)}</span> ر.ع
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ink" onClick={() => openPrint(saved.id, "80mm")}>طباعة حرارية 80mm</Button>
              <Button variant="outline" onClick={() => openPrint(saved.id, "a4")}>طباعة A4</Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setSaved(null)}>فاتورة جديدة</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd className="num">{formatMoney(value)}</dd>
    </div>
  );
}

function WeightModal({ product, onClose, onConfirm }: { product: Product; onClose: () => void; onConfirm: (kg: number) => void }) {
  const [mode, setMode] = useState<"grams" | "amount">("grams");
  const [value, setValue] = useState("");
  const num = Number(value) || 0;
  const kg = mode === "grams" ? num / 1000 : product.price > 0 ? num / product.price : 0;

  return (
    <Modal open onClose={onClose} title={product.name}>
      <div className="space-y-4">
        <div className="text-sm text-ink-mute">
          السعر <span className="num font-semibold text-date">{formatMoney(product.price)}</span> ر.ع للكيلو
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {QUICK_WEIGHTS.map((w) => (
            <button key={w} onClick={() => onConfirm(w)} className="h-12 rounded-lg border border-line bg-paper text-sm hover:border-gold hover:bg-date-soft cursor-pointer">
              {formatQty(w, "weight")}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-paper-deep p-1 text-sm">
          {(["grams", "amount"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setValue(""); }} className={`h-9 rounded-md cursor-pointer ${mode === m ? "bg-card shadow-sm" : "text-ink-mute"}`}>
              {m === "grams" ? "بالوزن (جرام)" : "بالمبلغ (ر.ع)"}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (kg > 0) onConfirm(kg);
          }}
          className="space-y-3"
        >
          <Input autoFocus type="number" min={0} step="any" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === "grams" ? "مثال: 750" : "مثال: 2.5"} className="num h-12 text-lg" />
          {kg > 0 && (
            <p className="text-sm text-ink-soft">
              {formatQty(round3(kg), "weight")} = <span className="num font-semibold">{formatMoney(roundMoney(round3(kg) * product.price))}</span> ر.ع
            </p>
          )}
          <Button type="submit" className="w-full" disabled={kg <= 0}>
            إضافة
          </Button>
        </form>
      </div>
    </Modal>
  );
}
