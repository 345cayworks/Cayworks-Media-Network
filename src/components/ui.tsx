import Link from "next/link";
import { clsx } from "@/lib/clsx";

const TONE: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-brand-100 text-brand-700",
  gray: "bg-slate-100 text-slate-600",
};

const STATUS_TONE: Record<string, keyof typeof TONE | string> = {
  ACTIVE: "green",
  APPROVED: "green",
  PAID: "green",
  CURRENT: "green",
  INACTIVE: "gray",
  ENDED: "gray",
  DRAFT: "gray",
  VOID: "gray",
  PAUSED: "amber",
  PENDING: "amber",
  SENT: "amber",
  PROSPECT: "amber",
  PAST_DUE: "amber",
  REJECTED: "red",
  OVERDUE: "red",
  ON_HOLD: "red",
};

export function Badge({ value }: { value: string }) {
  const tone = STATUS_TONE[value] ?? "blue";
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        TONE[tone] ?? TONE.blue,
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={variant === "primary" ? "btn-primary" : "btn-secondary"}
    >
      {children}
    </Link>
  );
}
