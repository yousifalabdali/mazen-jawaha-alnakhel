import { createClient } from "./supabase/client";

export const MENU_CHANNEL = "menu-updates";

/** إشعار شاشات العرض بإعادة تحميل القائمة بعد أي تعديل */
export async function notifyMenuChanged() {
  const supabase = createClient();
  const channel = supabase.channel(MENU_CHANNEL);
  try {
    await channel.httpSend("changed", { at: Date.now() });
  } catch {
    // شاشة العرض تعيد التحميل دورياً كل 60 ثانية على أي حال
  } finally {
    supabase.removeChannel(channel);
  }
}
