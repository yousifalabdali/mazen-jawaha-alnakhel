"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, Ornament } from "@/components/Logo";

const NAV = [
  { href: "/admin", label: "الرئيسية", icon: "M3 10l7-6 7 6v7h-5v-4H8v4H3z" },
  { href: "/admin/products", label: "المنتجات", icon: "M4 6h12l-1 11H5zM7 6V5a3 3 0 016 0v1" },
  { href: "/admin/categories", label: "الأقسام", icon: "M3 4h6v6H3zM11 4h6v6h-6zM3 12h6v5H3zM11 12h6v5h-6z" },
  { href: "/admin/inventory", label: "المخزون", icon: "M3 7l7-4 7 4v8l-7 4-7-4zM3 7l7 4 7-4M10 11v8" },
  { href: "/admin/invoices", label: "الفواتير", icon: "M5 2h10v16l-2.5-1.5L10 18l-2.5-1.5L5 18zM8 7h4M8 10h4" },
  { href: "/admin/users", label: "المستخدمون", icon: "M10 9a3 3 0 100-6 3 3 0 000 6zM4 17a6 6 0 0112 0" },
  { href: "/admin/settings", label: "الإعدادات", icon: "M10 13a3 3 0 100-6 3 3 0 000 6zM10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function AdminNav({ name }: { name: string }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));

  return (
    <aside className="bg-ink text-paper lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-4 lg:flex-col lg:py-8">
        <Link href="/admin" className="flex items-center gap-3 lg:flex-col">
          <Logo variant="light" size={44} className="lg:hidden" />
          <Logo variant="light" size={96} className="hidden lg:block" />
          <span className="font-display text-xl lg:text-2xl">جواهر النخيل</span>
        </Link>
        <Ornament tone="light" className="hidden w-full lg:flex" />
        <Link href="/pos" className="rounded-lg bg-date px-3 py-1.5 text-sm lg:hidden">نقطة البيع</Link>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              isActive(n.href) ? "bg-paper text-ink font-medium" : "text-paper/75 hover:bg-white/8 hover:text-paper"
            }`}
          >
            <Icon d={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="hidden space-y-2 border-t border-white/10 p-4 lg:block">
        <Link href="/pos" className="flex h-10 items-center justify-center rounded-lg bg-date text-sm font-medium hover:bg-date-deep">
          فتح نقطة البيع
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <a href="/display" target="_blank" className="flex h-10 items-center justify-center rounded-lg border border-white/15 text-sm text-paper/85 hover:bg-white/8">
            شاشة الصور ↗
          </a>
          <a href="/prices" target="_blank" className="flex h-10 items-center justify-center rounded-lg border border-white/15 text-sm text-paper/85 hover:bg-white/8">
            شاشة الأسعار ↗
          </a>
        </div>
        <div className="flex items-center justify-between pt-2 text-xs text-paper/60">
          <span>{name || "المدير"}</span>
          <form action="/logout" method="post">
            <button className="hover:text-paper cursor-pointer">تسجيل الخروج</button>
          </form>
        </div>
      </div>
    </aside>
  );
}
