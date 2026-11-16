import { createClient } from "@/lib/supabase/server";
import type { Category, Product } from "@/lib/types";
import ProductsClient from "./ProductsClient";

export const metadata = { title: "المنتجات — جواهر النخيل" };

export default async function ProductsPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: categories }, { data: costs }] = await Promise.all([
    supabase.from("products").select("*").order("sort_order").order("name"),
    supabase.from("categories").select("*").order("sort_order").order("name"),
    supabase.from("product_costs").select("product_id,cost_price"),
  ]);
  const costMap = Object.fromEntries((costs ?? []).map((c) => [c.product_id, Number(c.cost_price)]));
  return (
    <ProductsClient
      products={((products ?? []) as Product[]).map((p) => ({ ...p, price: Number(p.price), stock_qty: Number(p.stock_qty), low_stock_threshold: Number(p.low_stock_threshold) }))}
      categories={(categories ?? []) as Category[]}
      costs={costMap}
    />
  );
}
