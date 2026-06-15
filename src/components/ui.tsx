import Link from "next/link";
import { clsx } from "@/lib/clsx";
import { Sparkline } from "@/components/Chart";

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

const ACCENT: Record<string, string> = {
  brand: "from-brand-500/15 to-brand-500/0 ring-brand-500/30",
  emerald: "from-emerald-500/15 to-emerald-500/0 ring-emerald-500/30",
  amber: "from-amber-500/15 to-amber-500/0 ring-amber-500/30",
  rose: "from-rose-500/15 to-rose-500/0 ring-rose-500/30",
  slate: "from-slate-500/10 to-slate-500/0 ring-slate-300",
};

export function Stat({
  label,
  value,
  hint,
  accent = "brand",
  spark,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: keyof typeof ACCENT;
  /** Optional series for a small trend sparkline at the bottom. */
  spark?: number[];
}) {
  const sparkColor =
    accent === "emerald"
      ? "#10b981"
      : accent === "rose"
        ? "#f43f5e"
        : accent === "amber"
          ? "#f59e0b"
          : "#1f6feb";
  return (
    <div className="card relative overflow-hidden p-4">
      <div
        className={clsx(
          "pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br",
          ACCENT[accent] ?? ACCENT.brand,
        )}
      />
      <div className="relative">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
          {value}
        </div>
        {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
        {spark && spark.length > 0 && (
          <div className="mt-2 -mx-1 text-slate-400">
            <Sparkline
              values={spark}
              width={120}
              height={22}
              stroke={sparkColor}
              fill={`${sparkColor}22`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {right}
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
