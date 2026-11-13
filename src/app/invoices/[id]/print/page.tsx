/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatQty, roundMoney } from "@/lib/money";
import type { Invoice, InvoiceItem, Settings } from "@/lib/types";
import PrintActions from "./PrintActions";

export const metadata = { title: "طباعة فاتورة — جوهرة النخيل" };
export const dynamic = "force-dynamic";

export default async function PrintInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ size?: string; auto?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { size: sizeParam, auto } = await searchParams;
  const size = sizeParam === "a4" ? "a4" : "80mm";

  const supabase = await createClient();
  const [{ data: inv }, { data: items }, { data: settings }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("line_no").order("id"),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);
  if (!inv) notFound();
  const invoice = inv as Invoice;
  const s = settings as Settings;
  const lines = (items ?? []) as InvoiceItem[];

  let cashierName = "";
  if (invoice.cashier_id) {
    const { data: c } = await supabase.from("profiles").select("full_name").eq("id", invoice.cashier_id).maybeSingle();
    cashierName = c?.full_name ?? "";
  }

  const vat = Number(invoice.vat_amount);
  const total = Number(invoice.total);
  const taxable = roundMoney(total - vat);
  const showVat = invoice.vat_enabled;
  const title = showVat ? "فاتورة ضريبية" : "فاتورة مبيعات";
  const payment = invoice.payment_method === "cash" ? "كاش" : "شبكة";
  const isVoid = invoice.status === "void";

  const totalsRows: [string, number][] = [
    ["المجموع", Number(invoice.subtotal)],
    ...(Number(invoice.discount) > 0 ? ([["الخصم", -Number(invoice.discount)]] as [string, number][]) : []),
    ...(showVat
      ? ([
          ["الإجمالي غير شامل الضريبة", taxable],
          [`ضريبة القيمة المضافة ${Number(invoice.vat_rate)}%`, vat],
        ] as [string, number][])
      : []),
  ];

  return (
    <>
      <style>{`
        @page { ${size === "a4" ? "size: A4; margin: 14mm;" : "size: 80mm auto; margin: 0;"} }
        @media print { html, body { width: ${size === "a4" ? "auto" : "80mm"}; } }
      `}</style>
      <PrintActions id={id} size={size} auto={auto !== "0"} />

      {size === "80mm" ? (
        <div className="mx-auto my-6 w-[80mm] bg-white px-[4mm] py-[5mm] text-[12px] leading-snug text-black shadow-lg print:my-0 print:shadow-none">
          <div className="flex flex-col items-center text-center">
            <img src="/logo-ink.png" alt="" className="w-[26mm]" />
            <div className="mt-1 text-[11px]">{s.shop_subtitle}</div>
            {s.address && <div className="text-[10px]">{s.address}</div>}
            {s.phone && <div className="num text-[10px]">{s.phone}</div>}
            {showVat && s.vat_number && <div className="text-[10px]">الرقم الضريبي: <span className="num">{s.vat_number}</span></div>}
            {s.cr_number && <div className="text-[10px]">س.ت: <span className="num">{s.cr_number}</span></div>}
            <div className="mt-2 w-full border-y border-dashed border-black py-1 text-[13px] font-bold">{title}</div>
            {isVoid && <div className="mt-1 w-full border border-black py-0.5 font-bold">ملغاة</div>}
          </div>

          <div className="mt-2 space-y-0.5 text-[11px]">
            <Meta k="رقم الفاتورة" v={String(invoice.invoice_no)} />
            <Meta k="التاريخ" v={formatDateTime(invoice.created_at)} />
            {cashierName && <Meta k="الكاشير" v={cashierName} />}
            {invoice.customer_name && <Meta k="العميل" v={invoice.customer_name} />}
            {invoice.customer_phone && <Meta k="الجوال" v={invoice.customer_phone} />}
          </div>

          <table className="mt-2 w-full border-t border-dashed border-black text-[11px]">
            <thead>
              <tr className="border-b border-dashed border-black">
                <th className="py-1 text-right font-bold">الصنف</th>
                <th className="py-1 text-center font-bold">الكمية</th>
                <th className="py-1 text-left font-bold">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="py-1">
                    <div>{l.product_name}</div>
                    <div className="text-[10px] text-neutral-600"><span className="num">{formatMoney(l.unit_price)}</span> / {l.sale_type === "weight" ? "كيلو" : "حبة"}</div>
                  </td>
                  <td className="py-1 text-center whitespace-nowrap">{formatQty(l.qty, l.sale_type)}</td>
                  <td className="num py-1 text-left">{formatMoney(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-1 space-y-0.5 border-t border-dashed border-black pt-1 text-[11px]">
            {totalsRows.map(([k, v]) => (
              <Meta key={k} k={k} v={formatMoney(v)} num />
            ))}
            <div className="flex justify-between border-y border-black py-1 text-[14px] font-bold">
              <span>{showVat ? "الإجمالي شامل الضريبة" : "الإجمالي"}</span>
              <span className="num">{formatMoney(total)} ر.ع</span>
            </div>
            <Meta k="طريقة الدفع" v={payment} />
            {invoice.payment_method === "cash" && (
              <>
                <Meta k="المدفوع" v={formatMoney(invoice.paid_amount)} num />
                <Meta k="الباقي" v={formatMoney(invoice.change_amount)} num />
              </>
            )}
          </div>

          <div className="mt-3 text-center text-[11px]">{s.invoice_footer}</div>
        </div>
      ) : (
        <div className="mx-auto my-8 w-[210mm] min-h-[297mm] bg-white p-[14mm] text-[13px] text-black shadow-lg print:m-0 print:min-h-0 print:w-auto print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-5">
            <div className="space-y-0.5 text-[12px]">
              <div className="font-display text-[26px] leading-none">{s.shop_name}</div>
              <div className="text-neutral-700">{s.shop_subtitle}</div>
              {s.address && <div>{s.address}</div>}
              {s.phone && <div>الجوال: <span className="num">{s.phone}</span></div>}
              {showVat && s.vat_number && <div>الرقم الضريبي: <span className="num">{s.vat_number}</span></div>}
              {s.cr_number && <div>السجل التجاري: <span className="num">{s.cr_number}</span></div>}
            </div>
            <img src="/logo-ink.png" alt="" className="w-[34mm]" />
          </header>

          <div className="mt-6 flex items-end justify-between">
            <div>
              <h1 className="text-[22px] font-bold">{title}</h1>
              {isVoid && <span className="mt-1 inline-block border border-black px-2 text-[12px] font-bold">ملغاة</span>}
            </div>
            <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[12px]">
              <span className="text-neutral-600">رقم الفاتورة</span><span className="num font-semibold">{invoice.invoice_no}</span>
              <span className="text-neutral-600">التاريخ</span><span>{formatDateTime(invoice.created_at)}</span>
              {cashierName && (<><span className="text-neutral-600">الكاشير</span><span>{cashierName}</span></>)}
              <span className="text-neutral-600">طريقة الدفع</span><span>{payment}</span>
            </div>
          </div>

          {(invoice.customer_name || invoice.customer_phone) && (
            <div className="mt-4 rounded border border-neutral-300 px-3 py-2 text-[12px]">
              <span className="text-neutral-600">العميل: </span>
              {invoice.customer_name} {invoice.customer_phone && <span className="num">— {invoice.customer_phone}</span>}
            </div>
          )}

          <table className="mt-6 w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-neutral-900 text-white">
                <th className="px-3 py-2 text-right font-semibold">#</th>
                <th className="px-3 py-2 text-right font-semibold">الصنف</th>
                <th className="px-3 py-2 text-center font-semibold">الكمية</th>
                <th className="px-3 py-2 text-center font-semibold">سعر الوحدة</th>
                <th className="px-3 py-2 text-left font-semibold">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id} className="border-b border-neutral-200">
                  <td className="num px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2">{l.product_name}</td>
                  <td className="px-3 py-2 text-center">{formatQty(l.qty, l.sale_type)}</td>
                  <td className="px-3 py-2 text-center"><span className="num">{formatMoney(l.unit_price)}</span> / {l.sale_type === "weight" ? "كيلو" : "حبة"}</td>
                  <td className="num px-3 py-2 text-left">{formatMoney(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex items-start justify-between gap-8">
            <div className="flex items-end gap-4">
            </div>
            <div className="w-[85mm] space-y-1 text-[12px]">
              {totalsRows.map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-neutral-200 py-1">
                  <span className="text-neutral-700">{k}</span>
                  <span className="num">{formatMoney(v)}</span>
                </div>
              ))}
              <div className="flex justify-between bg-neutral-900 px-3 py-2 text-[15px] font-bold text-white">
                <span>{showVat ? "الإجمالي شامل الضريبة" : "الإجمالي"}</span>
                <span className="num">{formatMoney(total)} ر.ع</span>
              </div>
              {invoice.payment_method === "cash" && (
                <div className="flex justify-between pt-1 text-neutral-700">
                  <span>المدفوع / الباقي</span>
                  <span className="num">{formatMoney(invoice.paid_amount)} / {formatMoney(invoice.change_amount)}</span>
                </div>
              )}
            </div>
          </div>

          <footer className="mt-12 border-t border-neutral-300 pt-4 text-center text-[12px] text-neutral-700">
            {s.invoice_footer}
          </footer>
        </div>
      )}
    </>
  );
}

function Meta({ k, v, num }: { k: string; v: string; num?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{k}</span>
      <span className={num ? "num" : ""}>{v}</span>
    </div>
  );
}
