"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useCounterReceiver, type CounterState } from "@/lib/counter";
import { formatMoney, formatQty } from "@/lib/money";
import { DatePlaceholder, Logo, Ornament } from "@/components/Logo";

const DONE_SECONDS = 12;

export default function CustomerClient({ uid, shopName, subtitle }: { uid: string; shopName: string; subtitle: string }) {
  const [state, setState] = useState<CounterState | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const prevKeys = useRef<string[]>([]);

  useCounterReceiver(uid, (s) => {
    // آخر بند أُضيف أو تغيّرت كميته يُبرز للعميل
    const keys = s.items.map((i) => i.key + ":" + i.qty);
    const changed = keys.find((k) => !prevKeys.current.includes(k));
    prevKeys.current = keys;
    if (changed) setLastKey(changed.split(":")[0]);
    setState(s);
  });

  // شاشة الشكر تختفي بعد ثوانٍ
  useEffect(() => {
    if (state?.status !== "done") return;
    const t = setTimeout(() => setState((s) => (s?.status === "done" ? { ...s, status: "idle", items: [] } : s)), DONE_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [state?.status, state?.invoiceNo]);

  useEffect(() => {
    if (!lastKey || !listRef.current) return;
    listRef.current.querySelector(`[data-key="${CSS.escape(lastKey)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lastKey, state]);

  const status = state?.status ?? "idle";

  return (
    <div
      className="relative h-dvh cursor-none overflow-hidden select-none"
      onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
    >
      {status === "idle" && <Welcome shopName={shopName} subtitle={subtitle} />}
      {status === "done" && state && <ThankYou state={state} shopName={shopName} />}
      {status === "cart" && state && (
        <div className="grid h-full grid-cols-[1fr_36%]">
          {/* البنود */}
          <section className="flex min-h-0 flex-col px-[3vw] pt-[4vh]">
            <div className="flex items-center gap-[1.2vw]">
              <Logo size={60} className="w-[3.4vw]! min-w-10" />
              <div>
                <div className="font-display text-[2.4vw] leading-none">{shopName}</div>
                <div className="mt-[.5vh] text-[1vw] text-ink-mute">فاتورتك</div>
              </div>
              <span className="mr-auto rounded-full bg-paper-deep px-[1.1vw] py-[.5vh] text-[1.05vw] text-ink-soft">
                <span className="num">{state.items.length}</span> {state.items.length > 2 && state.items.length < 11 ? "أصناف" : "صنف"}
              </span>
            </div>
            <Ornament className="mt-[2.5vh]" />

            <ul ref={listRef} className="mt-[2vh] min-h-0 flex-1 space-y-[1.4vh] overflow-y-auto pb-[3vh] [scrollbar-width:none]">
              {state.items.map((it) => {
                const hot = it.key === lastKey;
                return (
                  <li
                    key={it.key}
                    data-key={it.key}
                    className={`flex items-center gap-[1.4vw] rounded-[1vw] border p-[1vh] pl-[1.6vw] transition-all duration-500 ${
                      hot ? "border-gold bg-card shadow-[0_.6vw_1.6vw_rgba(107,66,38,.14)] animate-[pop_.5s_ease]" : "border-line/80 bg-card/70"
                    }`}
                  >
                    <div className="h-[11vh] w-[11vh] shrink-0 overflow-hidden rounded-[.7vw] bg-paper-deep">
                      {it.image ? <img src={it.image} alt="" className="h-full w-full object-cover" /> : <DatePlaceholder className="h-full w-full" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[1.7vw] font-semibold leading-tight">{it.name}</div>
                      <div className="mt-[.6vh] text-[1.15vw] text-ink-mute">
                        <span>{formatQty(it.qty, it.saleType)}</span>
                        <span className="mx-[.5vw] text-line">×</span>
                        <span className="num">{formatMoney(it.price)}</span> ر.ع / {it.saleType === "weight" ? "كيلو" : "حبة"}
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="num text-[2vw] font-bold text-date">{formatMoney(it.line)}</span>
                      <span className="mr-[.4vw] text-[1vw] text-ink-mute">ر.ع</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* الإجمالي */}
          <aside className="relative flex flex-col justify-end overflow-hidden bg-ink px-[3vw] pb-[6vh] text-paper">
            <div className="pointer-events-none absolute -top-[6vh] -left-[6vw] opacity-[.06]" aria-hidden>
              <Logo variant="light" size={600} className="w-[34vw]!" />
            </div>
            <div className="relative space-y-[1.4vh] text-[1.35vw]">
              <Row label="المجموع" value={state.subtotal} />
              {state.discount > 0 && <Row label="الخصم" value={-state.discount} accent />}
              {state.vatEnabled && <Row label={`الضريبة ${state.vatRate}%`} value={state.vat} />}
            </div>
            <div className="relative mt-[3vh] border-t border-white/15 pt-[3vh]">
              <div className="text-[1.4vw] text-paper/60">الإجمالي</div>
              <div className="mt-[.5vh] flex items-baseline gap-[.8vw]">
                <span key={state.total} className="num animate-[pop_.4s_ease] text-[6vw] leading-none font-bold text-gold">{formatMoney(state.total)}</span>
                <span className="text-[1.8vw] text-paper/70">ر.ع</span>
              </div>
            </div>
            {state.method === "cash" && state.paid > state.total && (
              <div className="relative mt-[3vh] grid grid-cols-2 gap-[1vw] text-[1.2vw]">
                <div className="rounded-[.8vw] bg-white/6 p-[1.4vh_1.2vw]">
                  <div className="text-paper/55">المدفوع</div>
                  <div className="num mt-[.4vh] text-[2vw] font-semibold">{formatMoney(state.paid)}</div>
                </div>
                <div className="rounded-[.8vw] bg-ok/25 p-[1.4vh_1.2vw]">
                  <div className="text-paper/70">الباقي لك</div>
                  <div className="num mt-[.4vh] text-[2vw] font-semibold">{formatMoney(state.change)}</div>
                </div>
              </div>
            )}
            <div className="relative mt-[3vh] text-[1.1vw] text-paper/50">
              الدفع: {state.method === "cash" ? "نقداً" : "شبكة (مدى / فيزا)"}
            </div>
          </aside>
        </div>
      )}

      <style>{`
        @keyframes pop { 0% { transform: scale(.97); opacity: .6 } 60% { transform: scale(1.01) } 100% { transform: none; opacity: 1 } }
        @keyframes rise { from { opacity: 0; transform: translateY(2vh) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}

function Row({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-paper/60">{label}</span>
      <span className={`num font-medium ${accent ? "text-gold" : ""}`}>{formatMoney(value)}</span>
    </div>
  );
}

function Welcome({ shopName, subtitle }: { shopName: string; subtitle: string }) {
  return (
    <div className="flex h-full animate-[rise_.8s_ease] flex-col items-center justify-center bg-ink text-paper">
      <Logo variant="light" size={300} className="w-[17vw]!" />
      <div className="mt-[4vh] font-display text-[4.4vw] leading-none">{shopName}</div>
      <Ornament tone="light" className="mt-[3vh] w-[26vw]" />
      <div className="mt-[2.5vh] text-[1.6vw] text-paper/60">{subtitle}</div>
      <div className="mt-[6vh] font-display text-[2.4vw] text-gold">أهلاً وسهلاً بكم</div>
    </div>
  );
}

function ThankYou({ state, shopName }: { state: CounterState; shopName: string }) {
  return (
    <div className="flex h-full animate-[rise_.6s_ease] flex-col items-center justify-center bg-ink text-paper">
      <Logo variant="light" size={160} className="w-[9vw]!" />
      <div className="mt-[4vh] font-display text-[5vw] leading-none text-gold">شكراً لزيارتكم</div>
      <div className="mt-[2vh] text-[1.5vw] text-paper/60">{shopName}</div>
      <div className="mt-[6vh] flex gap-[2vw] text-center">
        <div className="min-w-[16vw] rounded-[1vw] bg-white/6 px-[2vw] py-[2.5vh]">
          <div className="text-[1.2vw] text-paper/55">الإجمالي</div>
          <div className="num mt-[.6vh] text-[3vw] font-bold">{formatMoney(state.total)}</div>
        </div>
        {state.change > 0 && (
          <div className="min-w-[16vw] rounded-[1vw] bg-ok/25 px-[2vw] py-[2.5vh]">
            <div className="text-[1.2vw] text-paper/70">الباقي لك</div>
            <div className="num mt-[.6vh] text-[3vw] font-bold">{formatMoney(state.change)}</div>
          </div>
        )}
      </div>
      {state.invoiceNo ? <div className="mt-[4vh] text-[1.1vw] text-paper/45">فاتورة رقم <span className="num">#{state.invoiceNo}</span></div> : null}
    </div>
  );
}
