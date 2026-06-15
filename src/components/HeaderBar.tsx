"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const CREATE_ITEMS = [
  { href: "/admin/advertisers/new", label: "New advertiser" },
  { href: "/admin/campaigns/new", label: "New campaign" },
  { href: "/admin/creatives/new", label: "New creative" },
  { href: "/admin/platforms/new", label: "Register platform" },
];

export function HeaderBar({
  userEmail,
  signOutSlot,
}: {
  userEmail: string;
  signOutSlot: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:px-6">
      <Link href="/admin" className="text-sm font-bold text-slate-900">
        Cayworks Ad Engine
      </Link>

      <div className="hidden flex-1 md:block">
        <input
          type="search"
          disabled
          placeholder="Search advertisers, campaigns, creatives… (coming soon)"
          title="Coming soon"
          className="w-full max-w-md cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400"
        />
      </div>

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="btn-primary"
        >
          + Create
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
            {CREATE_ITEMS.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                {it.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="hidden items-center gap-2 lg:flex">
        <span className="text-xs text-slate-500">{userEmail}</span>
        {signOutSlot}
      </div>
    </header>
  );
}
