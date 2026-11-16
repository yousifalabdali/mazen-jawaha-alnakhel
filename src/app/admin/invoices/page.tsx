import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, roundMoney } from "@/lib/money";
import { Badge, Card, PageHeader } from "@/components/ui";
import VoidButton from "./VoidButton";

export const metadata = { title: "الفواتير — جواهر النخيل" };

type Row = {
  id: string;
  invoice_no: number;
  created_at: string;
  total: number;
  vat_amount: number;
  vat_enabled: boolean;
  payment_method: "cash" | "card";
  status: "paid" | "void";
  customer_name: string | null;
  cashier: { full_name: string } | null;
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id,invoice_no,created_at,total,vat_amount,vat_enabled,payment_method,status,customer_name,cashier:profiles!invoices_cashier_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const no = Number(sp.q);
  if (sp.q && Number.isInteger(no)) query = query.eq("invoice_no", no);
  if (sp.from) query = query.gte("created_at", new Date(`${sp.from}T00:00:00+03:00`).toISOString());
  if (sp.to) query = query.lte("created_at", new Date(`${sp.to}T23:59:59.999+03:00`).toISOString());
  if (sp.status === "paid" || sp.status === "void") query = query.eq("status", sp.status);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const paid = rows.filter((r) => r.status === "paid");
  const total = roundMoney(paid.reduce((s, r) => s + Number(r.total), 0));
  const vat = roundMoney(paid.reduce((s, r) => s + Number(r.vat_amount), 0));

  return (
    <>
      <PageHeader title="الفواتير" subtitle="البحث وإعادة الطباعة وإلغاء الفواتير" />

      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="space-y-1">
          <span className="block text-ink-mute">رقم الفاتورة</span>
          <input name="q" defaultValue={sp.q} inputMode="numeric" className="num h-10 w-32 rounded-lg border border-line bg-card px-3" />
        </label>
        <label className="space-y-1">
          <span className="block text-ink-mute">من</span>
          <input type="date" name="from" defaultValue={sp.from} className="h-10 rounded-lg border border-line bg-card px-3" />
        </label>
        <label className="space-y-1">
          <span className="block text-ink-mute">إلى</span>
          <input type="date" name="to" defaultValue={sp.to} className="h-10 rounded-lg border border-line bg-card px-3" />
        </label>
        <label className="space-y-1">
          <span className="block text-ink-mute">الحالة</span>
          <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-lg border border-line bg-card px-3">
            <option value="">الكل</option>
            <option value="paid">مدفوعة</option>
            <option value="void">ملغاة</option>
          </select>
        </label>
        <button className="h-10 rounded-lg bg-ink px-4 text-paper cursor-pointer">بحث</button>
        <Link href="/admin/invoices" className="flex h-10 items-center px-3 text-ink-mute hover:text-ink">مسح</Link>
      </form>

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
        <span>عدد الفواتير المدفوعة: <b className="num">{paid.length}</b></span>
        <span>الإجمالي: <b className="num">{formatMoney(total)}</b> ر.ع</span>
        <span>الضريبة: <b className="num">{formatMoney(vat)}</b> ر.ع</span>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line text-ink-mute">
            <tr>
              <th className="px-4 py-3 text-right font-medium">الرقم</th>
              <th className="px-4 py-3 text-right font-medium">التاريخ</th>
              <th className="px-4 py-3 text-right font-medium">الكاشير</th>
              <th className="px-4 py-3 text-right font-medium">العميل</th>
              <th className="px-4 py-3 text-right font-medium">الدفع</th>
              <th className="px-4 py-3 text-right font-medium">الإجمالي</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "void" ? "text-ink-mute" : ""}>
                <td className="num px-4 py-2.5 font-medium">#{r.invoice_no}</td>
                <td className="px-4 py-2.5">{formatDateTime(r.created_at)}</td>
                <td className="px-4 py-2.5">{r.cashier?.full_name || "—"}</td>
                <td className="px-4 py-2.5">{r.customer_name || "—"}</td>
                <td className="px-4 py-2.5">{r.payment_method === "cash" ? "كاش" : "شبكة"}</td>
                <td className="px-4 py-2.5">
                  <span className={`num font-semibold ${r.status === "void" ? "line-through" : ""}`}>{formatMoney(r.total)}</span>
                  {!r.vat_enabled && <span className="mr-1.5"><Badge>بدون ضريبة</Badge></span>}
                  {r.status === "void" && <span className="mr-1.5"><Badge tone="danger">ملغاة</Badge></span>}
                </td>
                <td className="px-4 py-2.5 text-left whitespace-nowrap">
                  <a href={`/invoices/${r.id}/print?size=80mm`} target="_blank" className="rounded-md px-2 py-1 text-date hover:bg-date-soft">80mm</a>
                  <a href={`/invoices/${r.id}/print?size=a4`} target="_blank" className="rounded-md px-2 py-1 text-date hover:bg-date-soft">A4</a>
                  {r.status === "paid" && <VoidButton id={r.id} no={r.invoice_no} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-10 text-center text-ink-mute">لا توجد فواتير مطابقة</p>}
      </Card>
    </>
  );
}
