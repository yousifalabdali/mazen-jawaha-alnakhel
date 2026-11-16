import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import OrdersClient from "./OrdersClient";

export const metadata = { title: "الطلبات — جواهر النخيل" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("shop_name,whatsapp_ready_message").eq("id", 1).single();
  return (
    <OrdersClient
      isAdmin={profile.role === "admin"}
      shopName={settings?.shop_name ?? ""}
      template={settings?.whatsapp_ready_message ?? ""}
    />
  );
}
