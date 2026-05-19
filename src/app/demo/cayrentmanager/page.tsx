import { CayRentManagerDemo } from "./Demo";

export const dynamic = "force-dynamic";

/**
 * Standalone demo simulating how CayRentManager would embed the ad engine.
 * Provide the platform API key via ?key=... (demo only — never put real
 * keys in client URLs in production; inject them server-side instead).
 */
export default function DemoPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const engineUrl =
    process.env.NEXT_PUBLIC_AD_ENGINE_URL ?? "http://localhost:3000";
  const apiKey = searchParams.key ?? "";

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-xl font-bold">CayRentManager — Landlord Demo</h1>
          <p className="text-sm text-slate-500">
            Reference integration of the Cayworks Ad Engine plugin.
          </p>
        </header>

        {!apiKey ? (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            Append <code>?key=YOUR_PLATFORM_API_KEY</code> to this URL to load
            live ads. (In a real app the key is injected server-side, never
            exposed in the browser URL.)
          </div>
        ) : (
          <CayRentManagerDemo engineUrl={engineUrl} apiKey={apiKey} />
        )}
      </div>
    </div>
  );
}
