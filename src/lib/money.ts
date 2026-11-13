import type { SaleType } from "./types";

/** الريال العماني = 1000 بيسة، التقريب لثلاث خانات */
export const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
export const CURRENCY = "ر.ع";
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export interface TotalsInput {
  lines: { qty: number; price: number }[];
  discount: number;
  vatEnabled: boolean;
  vatRate: number; // نسبة مئوية مثل 5
  pricesIncludeVat: boolean;
}

export interface Totals {
  subtotal: number; // مجموع البنود قبل الخصم
  discount: number;
  net: number; // بعد الخصم
  vat: number;
  total: number; // المطلوب من العميل
  taxable: number; // المبلغ الخاضع للضريبة (بدون الضريبة)
}

/** نفس منطق create_invoice في قاعدة البيانات */
export function computeTotals(i: TotalsInput): Totals {
  const subtotal = roundMoney(i.lines.reduce((s, l) => s + roundMoney(round3(l.qty) * l.price), 0));
  const discount = Math.min(Math.max(roundMoney(i.discount || 0), 0), subtotal);
  const net = roundMoney(subtotal - discount);
  const r = i.vatRate / 100;
  let vat = 0;
  let total = net;
  if (i.vatEnabled) {
    if (i.pricesIncludeVat) {
      vat = roundMoney(net - net / (1 + r));
      total = net;
    } else {
      vat = roundMoney(net * r);
      total = roundMoney(net + vat);
    }
  }
  return { subtotal, discount, net, vat, total, taxable: roundMoney(total - vat) };
}

const moneyFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const formatMoney = (n: number | string) => moneyFmt.format(Number(n));

export function formatQty(qty: number | string, saleType: SaleType) {
  const q = Number(qty);
  if (saleType === "unit") return `${q} حبة`;
  if (q < 1) return `${Math.round(q * 1000)} جرام`;
  return `${round3(q)} كيلو`;
}

export const unitLabel = (t: SaleType) => (t === "weight" ? "كيلو" : "حبة");

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ar-OM-u-ca-gregory-nu-latn", {
    timeZone: "Asia/Muscat",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
