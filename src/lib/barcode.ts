import type { Product } from "./types";

export type ScanResult =
  | { kind: "product"; product: Product }
  | { kind: "weighed"; product: Product; kg: number } // ملصق ميزان: المنتج + الوزن
  | { kind: "unknown"; code: string };

/**
 * البحث عن منتج من كود الباركود:
 * 1) تطابق تام مع باركود المنتج.
 * 2) ملصق ميزان EAN-13 يبدأ بـ 2: [2X][PLU 5 أرقام][الوزن بالجرام 5 أرقام][رقم التحقق]
 *    حيث PLU هو باركود المنتج الموزون (مثلاً 00012).
 */
export function resolveBarcode(raw: string, products: Product[]): ScanResult {
  const code = raw.trim();
  const exact = products.find((p) => p.barcode === code);
  if (exact) return { kind: "product", product: exact };

  if (/^2\d{12}$/.test(code)) {
    const plu = code.slice(2, 7);
    const grams = Number(code.slice(7, 12));
    const product = products.find(
      (p) => p.sale_type === "weight" && p.barcode && (p.barcode === plu || p.barcode.replace(/^0+/, "") === plu.replace(/^0+/, "")),
    );
    if (product && grams > 0) return { kind: "weighed", product, kg: grams / 1000 };
  }
  return { kind: "unknown", code };
}

/** صوت قصير للتأكيد أو الخطأ عند المسح */
export function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 1250 : 320;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.09 : 0.25));
    osc.onended = () => ctx.close();
  } catch {
    // المتصفح لا يدعم الصوت
  }
}

/** صيغة الباركود المناسبة للطباعة */
export function barcodeFormat(code: string): "EAN13" | "CODE128" {
  if (!/^\d{13}$/.test(code)) return "CODE128";
  const d = code.split("").map(Number);
  const sum = d.slice(0, 12).reduce((s, n, i) => s + n * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === d[12] ? "EAN13" : "CODE128";
}
