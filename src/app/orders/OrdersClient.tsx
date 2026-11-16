"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, formatQty } from "@/lib/money";
import type { SaleType } from "@/lib/types";
import { buildReadyMessage, normalizePhone, whatsappLink } from "@/lib/whatsapp";
import { Logo } from "@/components/Logo";
import { Button, ErrorNote } from "@/components/ui";

type Status = "preparing" | "ready" | "delivered";
interface Order {
  id: string;
  invoice_no: number;
  customer_name: string | null;
  customer_phone: string | null;
  order_status: Status;
  order_note: string | null;
  total: number;
  created_at: string;
  ready_at: string | null;
  delivered_at: string | null;
  items: { name: string; qty: number; sale_type: SaleType }[] | null;
}

const COLUMNS: { status: Status; title: string; tone: string; empty: string }[] = [
  { status: "preparing", title: "قيد التجهيز", tone: "bg-date", empty: "لا توجد طلبات قيد التجهيز" },
  { status: "ready", title: "جاهز للاستلام", tone: "bg-ok", empty: "لا توجد طلبات بانتظار الاستلام" },
  { status: "delivered", title: "تم التسليم", tone: "bg-ink-mute", empty: "لم يُسلَّم شيء خلال اليومين الماضيين" },
];

const timeFmt = new Intl.DateTimeFormat("ar-OM-u-nu-latn", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });

function since(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  return h < 24 ? `منذ ${h} س` : timeFmt.format(new Date(iso));
}

export default function OrdersClient({ isAdmin, shopName, template }: { isAdmin: boolean; shopName: string; template: string }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("get_orders");
    if (error) setError(error.message);
    else setOrders(((data ?? []) as Order[]).map((o) => ({ ...o, total: Number(o.total) })));
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 20_000);
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(t);
    };
  }, [load]);

  function sendWhatsapp(o: Order) {
    const phone = normalizePhone(o.customer_phone ?? "");
    if (!phone) {
      setError(`رقم جوال الطلب #${o.invoice_no} غير صحيح`);
      return;
    }
    const text = buildReadyMessage(template, { name: o.customer_name, no: o.invoice_no, shop: shopName, total: o.total });
    window.open(whatsappLink(phone, text), "_blank", "noopener");
  }

  async function setStatus(o: Order, status: Status) {
    setError(null);
    setBusy(o.id);
    // نفتح الواتساب قبل أي انتظار حتى لا يمنعه المتصفح
    if (status === "ready") sendWhatsapp(o);
    const { error } = await createClient().rpc("set_order_status", { p_invoice: o.id, p_status: status });
    if (error) setError(error.message);
    await load();
    setBusy(null);
  }

  const count = (s: Status) => orders?.filter((o) => o.order_status === s).length ?? 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between bg-ink px-5 text-paper">
        <div className="flex items-center gap-3">
          <Logo variant="light" size={34} />
          <div className="leading-tight">
            <div className="font-display text-xl">{shopName}</div>
            <div className="text-xs text-paper/60">الطلبات</div>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/pos" className="rounded-lg bg-date px-3 py-1.5 hover:bg-date-deep">نقطة البيع</Link>
          {isAdmin && <Link href="/admin" className="rounded-lg px-3 py-1.5 text-paper/85 hover:bg-white/10">لوحة الإدارة</Link>}
        </nav>
      </header>

      <main className="flex-1 px-5 py-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line/70 pb-5">
          <div>
            <h1 className="font-display text-3xl">الطلبات</h1>
            <p className="mt-1 text-sm text-ink-mute">
              اضغط <b className="text-ink-soft">«جاهز»</b> عند انتهاء التجهيز: يفتح الواتساب ورسالة الزبون مكتوبة، اضغط إرسال.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>تحديث</Button>
        </div>
        <ErrorNote message={error} />

        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          {COLUMNS.map((col) => (
            <section key={col.status} className="flex flex-col rounded-2xl border border-line bg-paper-deep/40">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className={`h-2.5 w-2.5 rounded-full ${col.tone}`} />
                <h2 className="font-semibold">{col.title}</h2>
                <span className="num mr-auto rounded-full bg-card px-2.5 py-0.5 text-sm text-ink-soft">{count(col.status)}</span>
              </div>
              <div className="space-y-3 px-3 pb-3">
                {orders && !count(col.status) && <p className="py-10 text-center text-sm text-ink-mute">{col.empty}</p>}
                {orders
                  ?.filter((o) => o.order_status === col.status)
                  .map((o) => (
                    <article key={o.id} className={`rounded-xl border border-line bg-card p-4 shadow-sm ${col.status === "delivered" ? "opacity-70" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="num font-bold">#{o.invoice_no}</span>
                            <span className="truncate font-medium">{o.customer_name || "بدون اسم"}</span>
                          </div>
                          <a href={`tel:+${o.customer_phone}`} className="num text-sm text-ink-mute hover:text-ink">+{o.customer_phone}</a>
                        </div>
                        <div className="shrink-0 text-left text-xs text-ink-mute">
                          <div>{since(col.status === "ready" && o.ready_at ? o.ready_at : col.status === "delivered" && o.delivered_at ? o.delivered_at : o.created_at)}</div>
                          <div className="num mt-0.5 font-semibold text-date">{formatMoney(o.total)} ر.ع</div>
                        </div>
                      </div>

                      <ul className="mt-3 space-y-1 border-t border-line/70 pt-3 text-sm">
                        {(o.items ?? []).map((it, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span>{it.name}</span>
                            <span className="shrink-0 text-ink-mute">{formatQty(it.qty, it.sale_type)}</span>
                          </li>
                        ))}
                      </ul>
                      {o.order_note && <p className="mt-3 rounded-lg bg-date-soft px-3 py-2 text-sm text-date-deep">{o.order_note}</p>}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {col.status === "preparing" && (
                          <Button className="flex-1 bg-ok! hover:brightness-110" disabled={busy === o.id} onClick={() => setStatus(o, "ready")}>
                            <WhatsIcon /> جاهز — أرسل للزبون
                          </Button>
                        )}
                        {col.status === "ready" && (
                          <>
                            <Button className="flex-1" disabled={busy === o.id} onClick={() => setStatus(o, "delivered")}>تم التسليم</Button>
                            <Button variant="outline" onClick={() => sendWhatsapp(o)} title="إعادة إرسال الرسالة">
                              <WhatsIcon /> إعادة
                            </Button>
                            <Button variant="ghost" disabled={busy === o.id} onClick={() => setStatus(o, "preparing")}>رجوع</Button>
                          </>
                        )}
                        {col.status === "delivered" && (
                          <Button variant="ghost" size="sm" disabled={busy === o.id} onClick={() => setStatus(o, "ready")}>تراجع</Button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function WhatsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.1-1.2c0-.1-.2-.2-.5-.3z" />
    </svg>
  );
}
