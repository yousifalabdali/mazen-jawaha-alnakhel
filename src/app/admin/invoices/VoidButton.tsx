"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VoidButton({ id, no }: { id: string; no: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(`إلغاء الفاتورة رقم ${no}؟\nسيتم إرجاع الكميات إلى المخزون ولا يمكن التراجع.`)) return;
    setBusy(true);
    const { error } = await createClient().rpc("void_invoice", { p_invoice_id: id });
    setBusy(false);
    if (error) alert(error.message);
    router.refresh();
  }

  return (
    <button onClick={onClick} disabled={busy} className="rounded-md px-2 py-1 text-danger hover:bg-danger-soft disabled:opacity-50 cursor-pointer">
      إلغاء
    </button>
  );
}
