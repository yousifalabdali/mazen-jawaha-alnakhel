import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import InventoryClient, { type Movement } from "./InventoryClient";

export const metadata = { title: "المخزون — جوهرة النخيل" };

export default async function InventoryPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: movements }, { data: costs }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase
      .from("stock_movements")
      .select("id,product_id,change,reason,note,created_at,invoice:invoices(invoice_no),user:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("product_costs").select("product_id,cost_price"),
  ]);
  const costMap = Object.fromEntries((costs ?? []).map((c) => [c.product_id, Number(c.cost_price)]));
  return (
    <InventoryClient
      products={((products ?? []) as Product[]).map((p) => ({ ...p, stock_qty: Number(p.stock_qty), low_stock_threshold: Number(p.low_stock_threshold), price: Number(p.price) }))}
      movements={(movements ?? []) as unknown as Movement[]}
      costs={costMap}
    />
  );
}
