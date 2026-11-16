"use client";

import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Variant = "primary" | "ink" | "ghost" | "outline" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-date text-paper hover:bg-date-deep shadow-sm",
  ink: "bg-ink text-paper hover:bg-black shadow-sm",
  ghost: "text-ink-soft hover:bg-paper-deep hover:text-ink",
  outline: "border border-line bg-card text-ink hover:border-ink-mute",
  danger: "bg-danger text-paper hover:brightness-110",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-13 px-6 text-lg" : "h-10 px-4";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sz} ${variants[variant]} ${className}`}
    />
  );
}

const field =
  "w-full rounded-lg border border-line bg-card px-3 h-10 text-ink placeholder:text-ink-mute focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 transition";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${field} ${className}`} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${field} ${className}`} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${field} h-auto py-2 min-h-20 ${className}`} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-sm text-ink cursor-pointer"
    >
      <span
        className={`relative inline-block h-6 w-11 rounded-full transition-colors ${checked ? "bg-date" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${checked ? "right-5.5" : "right-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-card/90 shadow-[0_1px_0_rgba(38,36,34,.04)] ${className}`}>{children}</div>;
}

export function Badge({ tone = "mute", children }: { tone?: "mute" | "ok" | "danger" | "date"; children: ReactNode }) {
  const t = {
    mute: "bg-paper-deep text-ink-soft",
    ok: "bg-ok-soft text-ok",
    danger: "bg-danger-soft text-danger",
    date: "bg-date-soft text-date",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90dvh] overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-mute hover:bg-paper-deep hover:text-ink cursor-pointer" aria-label="إغلاق">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line/70 pb-5">
      <div>
        <h1 className="font-display text-3xl text-ink leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{message}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-ink-mute">{children}</div>;
}
