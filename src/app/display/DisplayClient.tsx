"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MENU_CHANNEL } from "@/lib/broadcast";
import { formatMoney } from "@/lib/money";
import type { DisplayMenu } from "@/lib/types";
import { DatePlaceholder, Logo, Ornament } from "@/components/Logo";

const PER_PAGE = 8; // 4 × 2 على شاشة التلفزيون

type Page = { category: string; products: DisplayMenu["categories"][number]["products"]; part: number; parts: number };

export default function DisplayClient() {
  const [menu, setMenu] = useState<DisplayMenu | null>(null);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("get_display_menu");
    if (!error && data) setMenu(data as DisplayMenu);
  }, []);

  // التحميل + التحديث اللحظي + احتياط كل دقيقة
  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase.channel(MENU_CHANNEL).on("broadcast", { event: "changed" }, () => load()).subscribe();
    const poll = setInterval(load, 60_000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const pages = useMemo<Page[]>(() => {
    if (!menu) return [];
    return menu.categories.flatMap((c) => {
      const parts = Math.max(1, Math.ceil(c.products.length / PER_PAGE));
      return Array.from({ length: parts }, (_, i) => ({
        category: c.name,
        products: c.products.slice(i * PER_PAGE, (i + 1) * PER_PAGE),
        part: i + 1,
        parts,
      }));
    });
  }, [menu]);

  const seconds = menu?.rotate_seconds ?? 12;
  useEffect(() => {
    if (pages.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % pages.length), seconds * 1000);
    return () => clearInterval(t);
  }, [pages.length, seconds]);

  const page = pages.length ? pages[index % pages.length] : null;

  return (
    <div
      className="relative flex h-dvh cursor-none flex-col overflow-hidden bg-ink text-paper select-none"
      onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
    >
      {/* خلفية: الشعار بشفافية خفيفة */}
      <div className="pointer-events-none absolute -left-[8vw] -bottom-[14vh] opacity-[.05]" aria-hidden>
        <Logo variant="light" size={760} />
      </div>

      <header className="relative flex items-center justify-between px-[4vw] pt-[3.5vh]">
        <div className="flex items-center gap-[1.5vw]">
          <Logo variant="light" size={88} className="w-[5.2vw]! min-w-14" />
          <div>
            <div className="font-display text-[3.2vw] leading-none">{menu?.shop_name ?? "جوهرة النخيل"}</div>
            <div className="mt-[.6vh] text-[1.15vw] text-paper/60">{menu?.shop_subtitle}</div>
          </div>
        </div>
        <div className="text-left">
          <div className="num text-[2.2vw] font-light tracking-wide">
            {now ? new Intl.DateTimeFormat("ar-OM-u-nu-latn", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true }).format(now) : ""}
          </div>
          <div className="text-[1vw] text-paper/50">
            {now ? new Intl.DateTimeFormat("ar-OM-u-ca-gregory-nu-latn", { timeZone: "Asia/Muscat", day: "numeric", month: "long", weekday: "long" }).format(now) : ""}
          </div>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col px-[4vw] pt-[3vh] pb-[4vh]">
        {page ? (
          <div key={`${page.category}-${page.part}`} className="flex min-h-0 flex-1 flex-col animate-[fadeIn_.8s_ease]">
            <div className="flex items-center gap-[2vw]">
              <h1 className="font-display text-[3.6vw] leading-tight text-gold">{page.category}</h1>
              <Ornament tone="light" className="flex-1" />
              {page.parts > 1 && (
                <span className="num text-[1.1vw] text-paper/50">
                  {page.part} / {page.parts}
                </span>
              )}
            </div>

            <div
              className="mt-[3vh] grid min-h-0 flex-1 grid-cols-4 gap-[1.6vw]"
              style={{ gridTemplateRows: page.products.length > 4 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 72%)" }}
            >
              {page.products.map((p) => (
                <article key={p.id} className="flex min-h-0 flex-col overflow-hidden rounded-[1.1vw] bg-paper text-ink shadow-[0_1vw_2.5vw_rgba(0,0,0,.35)]">
                  <div className="min-h-0 flex-1 overflow-hidden bg-paper-deep">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <DatePlaceholder className="h-full w-full" />
                    )}
                  </div>
                  <div className="px-[1.2vw] py-[1.4vh]">
                    <div className="truncate text-[1.55vw] font-semibold leading-snug">{p.name}</div>
                    {p.description && <div className="truncate text-[.95vw] text-ink-mute">{p.description}</div>}
                    <div className="mt-[.8vh] flex items-baseline gap-[.5vw]">
                      <span className="num text-[2.1vw] font-bold text-date">{formatMoney(p.price)}</span>
                      <span className="text-[1vw] text-ink-mute">ر.ع / {p.sale_type === "weight" ? "كيلو" : "حبة"}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[1.6vw] text-paper/50">{menu ? "لا توجد منتجات للعرض" : ""}</div>
        )}
      </main>

      {pages.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 h-[.5vh] bg-white/10">
          <div key={index} className="h-full bg-gold" style={{ animation: `progress ${seconds}s linear forwards` }} />
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(1.5vh) } to { opacity: 1; transform: none } }
        @keyframes progress { from { width: 0 } to { width: 100% } }
      `}</style>
    </div>
  );
}
