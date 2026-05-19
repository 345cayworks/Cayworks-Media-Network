import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/advertisers", label: "Advertisers" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/creatives", label: "Creatives" },
  { href: "/admin/platforms", label: "Platforms" },
  { href: "/admin/reporting", label: "Reporting" },
  { href: "/admin/test", label: "Test Delivery" },
  { href: "/admin/audit", label: "Audit Log" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <div>
            <div className="text-sm font-bold text-slate-900">
              Cayworks Ad Engine
            </div>
            <div className="text-xs text-slate-400">{user.role}</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:gap-0.5 lg:pb-4">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-slate-200 p-3 lg:block">
          <div className="mb-2 truncate text-xs text-slate-500">
            {user.email}
          </div>
          <form action={logoutAction}>
            <button className="btn-secondary w-full" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
