/**
 * رسائل واتساب "الطلب جاهز" عبر رابط wa.me:
 * يفتح واتساب المحل والرسالة مكتوبة، والموظف يضغط إرسال.
 */

/** يحوّل الرقم للصيغة الدولية. الأرقام العمانية المحلية (8 أرقام) تأخذ 968 تلقائياً */
export function normalizePhone(raw: string): string | null {
  let d = (raw || "").replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8 && /^[79]/.test(d)) d = "968" + d;
  if (d.length === 9 && d.startsWith("0")) d = "968" + d.slice(1);
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function buildReadyMessage(template: string, v: { name?: string | null; no: number; shop: string; total?: number }) {
  return template
    .replaceAll("{الاسم}", v.name?.trim() || "عميلنا العزيز")
    .replaceAll("{الرقم}", String(v.no))
    .replaceAll("{المحل}", v.shop)
    .replaceAll("{الإجمالي}", v.total != null ? v.total.toFixed(3) : "")
    .trim();
}

export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
