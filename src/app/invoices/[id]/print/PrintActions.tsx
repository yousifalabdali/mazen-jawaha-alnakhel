"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PrintActions({ id, size, auto }: { id: string; size: "80mm" | "a4"; auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const run = () => setTimeout(() => window.print(), 300);
    if (document.readyState === "complete") run();
    else window.addEventListener("load", run, { once: true });
  }, [auto]);

  const other = size === "a4" ? "80mm" : "a4";
  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-center gap-2 bg-ink px-4 py-3 text-sm text-paper">
      <button onClick={() => window.print()} className="rounded-lg bg-date px-4 py-2 font-medium hover:bg-date-deep cursor-pointer">
        طباعة
      </button>
      <Link href={`/invoices/${id}/print?size=${other}&auto=0`} className="rounded-lg px-4 py-2 hover:bg-white/10">
        عرض بمقاس {other === "a4" ? "A4" : "حراري 80mm"}
      </Link>
      <button onClick={() => window.close()} className="rounded-lg px-4 py-2 hover:bg-white/10 cursor-pointer">
        إغلاق
      </button>
    </div>
  );
}
