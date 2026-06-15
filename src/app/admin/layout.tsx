import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/app/login/actions";
import { HeaderBar } from "@/components/HeaderBar";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/approvals", label: "Approvals", badgeKey: "approvals" },
  { href: "/admin/advertisers", label: "Advertisers" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/creatives", label: "Creative Library" },
  { href: "/admin/platforms", label: "Platforms" },
  { href: "/admin/reporting", label: "Reporting" },
  { href: "/admin/test", label: "Test Delivery" },
  { href: "/admin/audit", label: "Audit Log" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const pendingApprovals = await prisma.creative
    .count({ where: { approvalStatus: "PENDING" } })
    .catch(() => 0);

  return (
    <div className="min-h-screen">
      <HeaderBar
        userEmail={user.email}
        signOutSlot={
          <form action={logoutAction}>
            <button className="btn-secondary" type="submit">
              Sign out
            </button>
          </form>
        }
      />

      <div className="lg:flex">
        <aside className="border-b border-slate-200 bg-white lg:w-60 lg:border-b-0 lg:border-r">
          <div className="px-4 py-3 lg:py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {user.role}
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:gap-0.5 lg:pb-4">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <span>{n.label}</span>
                {"badgeKey" in n && n.badgeKey === "approvals" && pendingApprovals > 0 && (
                  <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {pendingApprovals}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
