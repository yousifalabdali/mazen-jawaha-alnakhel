import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, roundMoney, round3, unitLabel } from "@/lib/money";
import type { Invoice, Product } from "@/lib/types";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "لوحة الإدارة — جواهر النخيل" };

const DAY = 86_400_000;
const TZ_OFFSET = 4 * 3_600_000;

export default async function AdminHome() {
  const supabase = await createClient();
  const now = Date.now();
  const todayStart = new Date(Math.floor((now + TZ_OFFSET) / DAY) * DAY - TZ_OFFSET);
  const localNow = new Date(now + TZ_OFFSET);
  const monthStart = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1) - TZ_OFFSET);

  const [{ data: month }, { data: products }, { data: recent }] = await Promise.all([
    supabase.from("invoices").select("total,vat_amount,payment_method,created_at").eq("status", "paid").gte("created_at", monthStart.toISOString()),
    supabase.from("products").select("id,name,sale_type,stock_qty,low_stock_threshold").eq("is_active", true),
    supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(8),
  ]);

  const monthRows = month ?? [];
  const todayRows = monthRows.filter((r) => new Date(r.created_at) >= todayStart);
  const sum = (rows: typeof monthRows, f: (r: (typeof monthRows)[number]) => boolean = () => true) =>
    roundMoney(rows.filter(f).reduce((s, r) => s + Number(r.total), 0));

  const todayTotal = sum(todayRows);
  const lowStock = ((products ?? []) as Product[]).filter((p) => Number(p.stock_qty) <= Number(p.low_stock_threshold));

  const stats = [
    { label: "مبيعات اليوم", value: formatMoney(todayTotal), unit: "ر.ع" },
    { label: "فواتير اليوم", value: String(todayRows.length), unit: "فاتورة" },
    { label: "كاش اليوم", value: formatMoney(sum(todayRows, (r) => r.payment_method === "cash")), unit: `ر.ع · شبكة ${formatMoney(sum(todayRows, (r) => r.payment_method === "card"))}` },
    { label: "مبيعات الشهر", value: formatMoney(sum(monthRows)), unit: "ر.ع" },
  ];

  return (
    <>
      <PageHeader title="الرئيسية" subtitle={new Intl.DateTimeFormat("ar-OM-u-ca-gregory-nu-latn", { timeZone: "Asia/Muscat", dateStyle: "full" }).format(new Date())} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <Card key={s.label} className={`p-5 ${i === 0 ? "bg-ink! text-paper border-ink" : ""}`}>
            <div className={`text-sm ${i === 0 ? "text-paper/65" : "text-ink-mute"}`}>{s.label}</div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="num text-2xl font-semibold">{s.value}</span>
              <span className={`text-xs ${i === 0 ? "text-paper/60" : "text-ink-mute"}`}>{s.unit}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl">آخر الفواتير</h2>
            <Link href="/admin/invoices" className="text-sm text-date hover:underline">عرض الكل</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {((recent ?? []) as Invoice[]).map((inv) => (
                <tr key={inv.id}>
                  <td className="num py-2.5 pl-4 font-medium">#{inv.invoice_no}</td>
                  <td className="py-2.5 text-ink-mute">{formatDateTime(inv.created_at)}</td>
                  <td className="py-2.5">{inv.payment_method === "cash" ? "كاش" : "شبكة"}</td>
                  <td className="py-2.5">{inv.status === "void" && <Badge tone="danger">ملغاة</Badge>}</td>
                  <td className="num py-2.5 text-left font-semibold">{formatMoney(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recent?.length && <p className="py-8 text-center text-sm text-ink-mute">لا توجد فواتير بعد</p>}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl">تنبيهات المخزون</h2>
            <Link href="/admin/inventory" className="text-sm text-date hover:underline">إدارة المخزون</Link>
          </div>
          {lowStock.length ? (
            <ul className="divide-y divide-line text-sm">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span>{p.name}</span>
                  <Badge tone="danger">
                    <span className="num">{round3(Number(p.stock_qty))}</span>&nbsp;{unitLabel(p.sale_type)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-ink-mute">كل المنتجات فوق حد التنبيه</p>
          )}
        </Card>
      </div>
    </>
  );
}
