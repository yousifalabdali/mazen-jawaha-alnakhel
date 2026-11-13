import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category, Product, Settings } from "@/lib/types";
import PosClient from "./PosClient";

export const metadata = { title: "نقطة البيع — جوهرة النخيل" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const profile = await requireStaff();
  const supabase = await createClient();
  const [{ data: categories }, { data: products }, { data: settings }] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("products").select("*").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);

  return (
    <PosClient
      profile={profile}
      categories={(categories ?? []) as Category[]}
      products={((products ?? []) as Product[]).map((p) => ({ ...p, price: Number(p.price), stock_qty: Number(p.stock_qty) }))}
      settings={settings as Settings}
    />
  );
}
