import { createClient } from "@/lib/supabase/server";
import type { Settings } from "@/lib/types";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "الإعدادات — جواهر النخيل" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
  return <SettingsClient settings={data as Settings} />;
}
