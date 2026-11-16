"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MENU_CHANNEL } from "@/lib/broadcast";
import { formatMoney } from "@/lib/money";
import type { DisplayMenu } from "@/lib/types";
import { Logo, Ornament } from "@/components/Logo";

/**
 * شاشة الأسعار: كل المنتجات بأسعارها على شاشة واحدة بدون صور.
 * حجم الخط يتكيّف تلقائياً حتى تتسع القائمة كاملة بدون تمرير.
 */
export default function PricesClient() {
  const [menu, setMenu] = useState<DisplayMenu | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("get_display_menu");
    if (!error && data) setMenu(data as DisplayMenu);
  }, []);

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

  const categories = (menu?.categories ?? []).filter((c) => c.products.length);
  const rows = categories.reduce((n, c) => n + c.products.length + 2, 0);
  const cols = Math.min(categories.length, rows <= 9 ? 1 : rows <= 30 ? 2 : 3) || 1;

  // توزيع الأقسام على الأعمدة بالتوازن (الأطول أولاً في العمود الأقصر)
  const columns: typeof categories[] = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  for (const c of categories) {
    const i = heights.indexOf(Math.min(...heights));
    columns[i].push(c);
    heights[i] += c.products.length + 2;
  }

  // ملاءمة الخط لمساحة الشاشة (بحث ثنائي على حجم الخط)
  useLayoutEffect(() => {
    const area = areaRef.current;
    const list = listRef.current;
    if (!area || !list) return;
    const fit = () => {
      let lo = 0.5, hi = cols === 1 ? 3.2 : 2.2;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        list.style.fontSize = `${mid}vw`;
        if (list.scrollHeight <= area.clientHeight && list.scrollWidth <= area.clientWidth) lo = mid;
        else hi = mid;
      }
      list.style.fontSize = `${lo}vw`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(area);
    return () => ro.disconnect();
  }, [menu, cols]);

  return (
    <div
      className="prices relative flex h-dvh cursor-none flex-col overflow-hidden text-paper select-none"
      onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
    >
      {/* إطار مزدوج وعلامة مائية من الشعار */}
      <div className="pointer-events-none absolute -right-[6vw] top-1/2 -translate-y-1/2 opacity-[.045]" aria-hidden>
        <Logo variant="light" size={640} className="w-[34vw]!" />
      </div>
      <div className="pointer-events-none absolute inset-[1.6vw] rounded-[1.2vw] border border-gold/25" aria-hidden />
      <div className="pointer-events-none absolute inset-[2.1vw] rounded-[.9vw] border border-gold/10" aria-hidden />

      <header className="relative flex flex-col items-center pt-[4.5vh]">
        <div className="flex items-center gap-[1.4vw]">
          <Logo variant="light" size={80} className="w-[4.2vw]! min-w-12" />
          <h1 className="font-display text-[3.4vw] leading-none">{menu?.shop_name ?? "جواهر النخيل"}</h1>
        </div>
        <div className="mt-[1.6vh] flex w-[34vw] items-center gap-[1vw]">
          <Ornament className="flex-1" />
          <span className="shrink-0 text-[1.05vw] tracking-[.35em] text-gold">قائمة الأسعار</span>
          <Ornament className="flex-1" />
        </div>
      </header>

      <main ref={areaRef} className="relative mx-[6vw] mt-[3.5vh] mb-[6vh] min-h-0 flex-1 overflow-hidden">
        {menu && !categories.length && (
          <div className="flex h-full items-center justify-center text-[1.6vw] text-paper/50">لا توجد منتجات للعرض</div>
        )}
        <div
          ref={listRef}
          className="mx-auto grid animate-[fadeIn_.7s_ease] gap-x-[4.5vw]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: cols === 1 ? "50vw" : undefined, fontSize: "1.4vw" }}
        >
          {columns.map((col, ci) => (
          <div key={ci} className={ci < cols - 1 ? "-ml-[2.25vw] border-l border-gold/15 pl-[2.25vw]" : ""}>
          {col.map((c) => (
            <section key={c.id} className="mb-[1.4em]">
              <h2 className="mb-[.5em] flex items-center gap-[.6em] font-display text-[1.35em] leading-tight text-gold">
                <svg viewBox="0 0 14 10" className="h-[.45em] w-[.7em] shrink-0" aria-hidden>
                  <ellipse cx="7" cy="5" rx="6" ry="4" fill="currentColor" />
                </svg>
                {c.name}
              </h2>
              <ul>
                {c.products.map((p) => (
                  <li key={p.id} className="flex items-baseline gap-[.5em] py-[.32em]">
                    <span className="font-medium">{p.name}</span>
                    <span className="mb-[.28em] min-w-[1.5em] flex-1 border-b-2 border-dotted border-paper/20" aria-hidden />
                    <span className="num font-bold">{formatMoney(p.price)}</span>
                    <span className="w-[5.2em] shrink-0 whitespace-nowrap text-[.6em] text-paper/55">ر.ع / {p.sale_type === "weight" ? "كيلو" : "حبة"}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          </div>
          ))}
        </div>
      </main>

      <footer className="pointer-events-none absolute inset-x-0 bottom-[3.2vh] text-center text-[.95vw] text-paper/45">
        {menu?.shop_subtitle}
      </footer>

      <style>{`
        .prices { background: radial-gradient(ellipse 70% 55% at 50% 0%, #3a2a1e 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 50% 110%, #2f241c 0%, transparent 70%), var(--color-ink); }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
