"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { barcodeFormat } from "@/lib/barcode";

export function Barcode({ value, height = 40, width = 1.6, fontSize = 12, className = "" }: { value: string; height?: number; width?: number; fontSize?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: barcodeFormat(value),
        height,
        width,
        fontSize,
        margin: 0,
        textMargin: 1,
        background: "transparent",
        lineColor: "#000",
      });
    } catch {
      JsBarcode(ref.current, value, { format: "CODE128", height, width, fontSize, margin: 0, background: "transparent" });
    }
  }, [value, height, width, fontSize]);
  return <svg ref={ref} className={className} />;
}
