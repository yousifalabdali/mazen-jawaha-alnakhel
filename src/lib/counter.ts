"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod, SaleType } from "@/lib/types";

/** ما تعرضه شاشة العميل: يُرسل من نقطة البيع عند كل تغيير في الفاتورة */
export interface CounterState {
  status: "idle" | "cart" | "done";
  items: { key: string; name: string; image: string | null; saleType: SaleType; qty: number; price: number; line: number }[];
  subtotal: number;
  discount: number;
  vat: number;
  vatRate: number;
  vatEnabled: boolean;
  total: number;
  method: PaymentMethod;
  paid: number;
  change: number;
  invoiceNo?: number;
}

type Msg = { type: "hello" } | { type: "state"; state: CounterState };

const channelName = (uid: string) => `counter-${uid}`;

/**
 * قناتان معاً:
 * - BroadcastChannel: نفس الجهاز (شاشة ثانية) — فوري وبدون إنترنت
 * - Supabase Realtime: جهاز آخر (تابلت) مسجّل بنفس حساب الكاشير
 */
function openChannels(uid: string, onMessage: (msg: Msg) => void) {
  const local = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(channelName(uid)) : null;
  if (local) local.onmessage = (e) => onMessage(e.data);
  const supabase = createClient();
  const remote: RealtimeChannel = supabase
    .channel(channelName(uid), { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "msg" }, ({ payload }) => onMessage(payload as Msg))
    .subscribe();
  return {
    send(msg: Msg) {
      local?.postMessage(msg);
      if (remote.state === "joined") remote.send({ type: "broadcast", event: "msg", payload: msg }).catch(() => {});
    },
    close() {
      local?.close();
      supabase.removeChannel(remote);
    },
  };
}

/** نقطة البيع: ترسل الحالة كلما تغيرت، وتعيد إرسالها عندما تفتح شاشة العميل */
export function useCounterSender(uid: string, state: CounterState) {
  const latest = useRef(state);
  latest.current = state;
  const ch = useRef<ReturnType<typeof openChannels> | null>(null);

  useEffect(() => {
    const c = openChannels(uid, (msg) => {
      if (msg.type === "hello") c.send({ type: "state", state: latest.current });
    });
    ch.current = c;
    const t = setTimeout(() => c.send({ type: "state", state: latest.current }), 2000);
    return () => {
      clearTimeout(t);
      c.close();
      ch.current = null;
    };
  }, [uid]);

  const json = JSON.stringify(state);
  useEffect(() => {
    ch.current?.send({ type: "state", state: JSON.parse(json) });
  }, [json]);
}

/** شاشة العميل: تستقبل الحالة وتطلبها عند الفتح */
export function useCounterReceiver(uid: string, onState: (s: CounterState) => void) {
  const cb = useRef(onState);
  cb.current = onState;
  useEffect(() => {
    const c = openChannels(uid, (msg) => {
      if (msg.type === "state") cb.current(msg.state);
    });
    c.send({ type: "hello" });
    const t = setTimeout(() => c.send({ type: "hello" }), 2000);
    return () => {
      clearTimeout(t);
      c.close();
    };
  }, [uid]);
}
