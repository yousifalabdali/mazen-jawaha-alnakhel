import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import CategoriesClient from "./CategoriesClient";

export const metadata = { title: "الأقسام — جواهر النخيل" };

export default async function CategoriesPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name"),
    supabase.from("products").select("category_id"),
  ]);
  const counts: Record<string, number> = {};
  (products ?? []).forEach((p) => {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  });
  return <CategoriesClient categories={(categories ?? []) as Category[]} counts={counts} />;
}
