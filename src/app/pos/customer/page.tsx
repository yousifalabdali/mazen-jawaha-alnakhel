import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CustomerClient from "./CustomerClient";

export const metadata = { title: "شاشة العميل — جواهر النخيل" };
export const dynamic = "force-dynamic";

export default async function CustomerPage() {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("shop_name,shop_subtitle").eq("id", 1).single();
  return <CustomerClient uid={profile.id} shopName={settings?.shop_name ?? ""} subtitle={settings?.shop_subtitle ?? ""} />;
}
