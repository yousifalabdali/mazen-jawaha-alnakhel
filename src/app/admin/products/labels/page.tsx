import { createClient } from "@/lib/supabase/server";
import type { Product, Settings } from "@/lib/types";
import LabelsClient from "./LabelsClient";

export const metadata = { title: "طباعة الباركود — جوهرة النخيل" };

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const supabase = await createClient();
  const [{ data: products }, { data: settings }] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("settings").select("shop_name").eq("id", 1).single(),
  ]);
  const selected = ids ? ids.split(",").filter(Boolean) : [];
  return (
    <LabelsClient
      products={((products ?? []) as Product[]).map((p) => ({ ...p, price: Number(p.price) }))}
      shopName={(settings as Pick<Settings, "shop_name">)?.shop_name ?? ""}
      initialSelected={selected}
    />
  );
}
