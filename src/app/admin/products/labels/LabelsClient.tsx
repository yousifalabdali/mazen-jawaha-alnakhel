"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CURRENCY, formatMoney, unitLabel } from "@/lib/money";
import type { Product } from "@/lib/types";
import { Barcode } from "@/components/Barcode";
import { Button, Card, Input, PageHeader, Select, Switch } from "@/components/ui";

type Size = "50x30" | "40x25" | "a4";
const SIZES: Record<Size, { label: string; w: number; h: number }> = {
  "50x30": { label: "ملصق 50 × 30 مم (طابعة ملصقات)", w: 50, h: 30 },
  "40x25": { label: "ملصق 40 × 25 مم (طابعة ملصقات)", w: 40, h: 25 },
  a4: { label: "ورق A4 — 3 × 8 ملصقات", w: 70, h: 37 },
};

export default function LabelsClient({
  products,
  shopName,
  initialSelected,
}: {
  products: Product[];
  shopName: string;
  initialSelected: string[];
}) {
  const [copies, setCopies] = useState<Record<string, number>>(() =>
    Object.fromEntries((initialSelected.length ? initialSelected : []).map((id) => [id, 1])),
  );
  const [size, setSize] = useState<Size>("50x30");
  const [showPrice, setShowPrice] = useState(true);
  const [showShop, setShowShop] = useState(true);
  const [q, setQ] = useState("");

  const labels = useMemo(
    () => products.flatMap((p) => Array.from({ length: copies[p.id] ?? 0 }, () => p)).filter((p) => p.barcode),
    [products, copies],
  );
  const s = SIZES[size];
  const list = products.filter((p) => !q.trim() || p.name.includes(q.trim()) || p.barcode?.includes(q.trim()));
  const setCount = (id: string, n: number) => setCopies((c) => ({ ...c, [id]: Math.max(0, Math.min(200, n || 0)) }));

  const labelBox = (p: Product, i: number) => (
    <div
      key={`${p.id}-${i}`}
      className="label flex flex-col items-center justify-center overflow-hidden bg-white text-black"
      style={{ width: `${s.w}mm`, height: `${s.h}mm`, padding: "1.5mm 2mm" }}
    >
      {showShop && <div className="truncate font-display leading-none" style={{ fontSize: size === "40x25" ? "8pt" : "9pt" }}>{shopName}</div>}
      <div className="w-full truncate text-center font-semibold leading-tight" style={{ fontSize: size === "40x25" ? "7.5pt" : "8.5pt" }}>{p.name}</div>
      <Barcode value={p.barcode!} height={size === "40x25" ? 28 : 36} width={1.4} fontSize={10} className="mt-0.5 max-w-full" />
      {showPrice && (
        <div className="leading-none" style={{ fontSize: "8.5pt" }}>
          <b className="num">{formatMoney(p.price)}</b> {CURRENCY} / {unitLabel(p.sale_type)}
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          @page { ${size === "a4" ? "size: A4; margin: 10mm 0;" : `size: ${s.w}mm ${s.h}mm; margin: 0;`} }
          body * { visibility: hidden; }
          #labels, #labels * { visibility: visible; }
          [role=switch] { display: none !important; }
          #labels { position: absolute; inset: 0; ${size === "a4" ? "" : "display: block !important;"} }
          ${size === "a4" ? "" : "#labels .label { page-break-after: always; break-after: page; }"}
        }
      `}</style>

      <div>
        <PageHeader
          title="طباعة الباركود"
          subtitle="اختر المنتجات وعدد النسخ ثم اطبع"
          actions={
            <>
              <Link href="/admin/products" className="text-sm text-ink-mute hover:text-ink">رجوع للمنتجات</Link>
              <Button onClick={() => window.print()} disabled={!labels.length}>
                طباعة {labels.length ? `(${labels.length})` : ""}
              </Button>
            </>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <Card className="space-y-4 p-5">
            <Select value={size} onChange={(e) => setSize(e.target.value as Size)}>
              {Object.entries(SIZES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-5">
              <Switch checked={showPrice} onChange={setShowPrice} label="إظهار السعر" />
              <Switch checked={showShop} onChange={setShowShop} label="اسم المحل" />
            </div>
            <Input placeholder="بحث بالاسم أو الباركود…" value={q} onChange={(e) => setQ(e.target.value)} />
            <ul className="max-h-[55dvh] divide-y divide-line overflow-y-auto">
              {list.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="num text-xs text-ink-mute">{p.barcode}</div>
                  </div>
                  <div className="flex items-center rounded-lg border border-line">
                    <button className="h-8 w-8 cursor-pointer hover:bg-paper-deep" onClick={() => setCount(p.id, (copies[p.id] ?? 0) + 1)}>+</button>
                    <input
                      className="num h-8 w-12 bg-transparent text-center"
                      inputMode="numeric"
                      value={copies[p.id] ?? 0}
                      onChange={(e) => setCount(p.id, Number(e.target.value))}
                      aria-label={`عدد نسخ ${p.name}`}
                    />
                    <button className="h-8 w-8 cursor-pointer hover:bg-paper-deep" onClick={() => setCount(p.id, (copies[p.id] ?? 0) - 1)}>−</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 text-sm">
              <button className="text-date hover:underline cursor-pointer" onClick={() => setCopies(Object.fromEntries(products.map((p) => [p.id, 1])))}>نسخة من الكل</button>
              <span className="text-line">|</span>
              <button className="text-ink-mute hover:underline cursor-pointer" onClick={() => setCopies({})}>مسح</button>
            </div>
          </Card>

          <Card className="min-h-60 overflow-auto bg-paper-deep/60 p-5">
            <div className="mb-3 text-sm text-ink-mute">معاينة</div>
            {!labels.length && <p className="py-16 text-center text-ink-mute">لم تختر أي منتج</p>}
            {/* الملصقات: معاينة على الشاشة، وهي وحدها ما يُطبع */}
            <div
              id="labels"
              className={size === "a4" ? "grid grid-cols-3 justify-items-center" : "flex flex-wrap gap-2"}
              style={size === "a4" ? { width: "210mm" } : undefined}
            >
              {labels.map(labelBox)}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
