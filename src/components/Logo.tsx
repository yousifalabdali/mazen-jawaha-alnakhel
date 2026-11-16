/* eslint-disable @next/next/no-img-element */

export function Logo({
  size = 64,
  variant = "ink",
  className = "",
}: {
  size?: number;
  variant?: "ink" | "light";
  className?: string;
}) {
  return (
    <img
      src={variant === "ink" ? "/logo-ink.png" : "/logo-light.png"}
      alt="جواهر النخيل"
      width={size}
      height={Math.round(size * 1.22)}
      className={className}
      style={{ width: size, height: "auto" }}
    />
  );
}

/** فاصل زخرفي: خطان رفيعان تتوسطهما حبة تمر */
export function Ornament({ className = "", tone = "gold" }: { className?: string; tone?: "gold" | "light" }) {
  const c = tone === "gold" ? "var(--color-gold)" : "rgba(244,241,234,.55)";
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <span className="h-px flex-1" style={{ background: `linear-gradient(to left, ${c}, transparent)` }} />
      <svg width="28" height="14" viewBox="0 0 28 14">
        <ellipse cx="14" cy="7" rx="6" ry="4.2" fill={c} />
        <path d="M2 7h5M21 7h5" stroke={c} strokeWidth="1" />
      </svg>
      <span className="h-px flex-1" style={{ background: `linear-gradient(to right, ${c}, transparent)` }} />
    </div>
  );
}

/** صورة بديلة للمنتج بدون صورة: حبة تمر بخطوط الحبر */
export function DatePlaceholder({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  const ink = dark ? "#f4f1ea" : "#6b4226";
  return (
    <svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <rect width="120" height="90" fill={dark ? "#33302d" : "#efe8db"} />
      <g transform="translate(60 47) rotate(-24)">
        <ellipse rx="26" ry="15" fill={ink} opacity=".92" />
        <path d="M-18 -3 Q0 -9 18 -3" stroke={dark ? "#33302d" : "#efe8db"} strokeWidth="1.6" fill="none" opacity=".5" />
      </g>
      <path d="M78 20 q-6 8 -12 14" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
