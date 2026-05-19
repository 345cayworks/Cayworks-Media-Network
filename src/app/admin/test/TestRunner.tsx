"use client";

import { useEffect, useMemo, useState } from "react";
import { AdSlot } from "@/plugin/AdSlot";

type Placement = { id: string; placementKey: string; name: string };
type PlatformLite = {
  slug: string;
  name: string;
  placements: Placement[];
};

type StepResult = {
  status: number;
  ok: boolean;
  body: unknown;
};

function StatusPill({ r }: { r: StepResult | null }) {
  if (!r) return <span className="text-xs text-slate-400">not run</span>;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        r.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {r.status} {r.ok ? "OK" : "FAIL"}
    </span>
  );
}

function Result({ r }: { r: StepResult | null }) {
  if (!r) return null;
  return (
    <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
      {JSON.stringify(r.body, null, 2)}
    </pre>
  );
}

export function TestRunner({
  engineUrl,
  platforms,
}: {
  engineUrl: string;
  platforms: PlatformLite[];
}) {
  const [slug, setSlug] = useState(platforms[0]?.slug ?? "");
  const platform = useMemo(
    () => platforms.find((p) => p.slug === slug),
    [platforms, slug],
  );
  const [placement, setPlacement] = useState(
    platform?.placements[0]?.placementKey ?? "",
  );
  const [apiKey, setApiKey] = useState("");
  const [userRole, setUserRole] = useState("MEMBER");

  const [serve, setServe] = useState<StepResult | null>(null);
  const [diagnose, setDiagnose] = useState<StepResult | null>(null);
  const [impression, setImpression] = useState<StepResult | null>(null);
  const [click, setClick] = useState<StepResult | null>(null);

  useEffect(() => {
    setPlacement(platform?.placements[0]?.placementKey ?? "");
    setServe(null);
    setDiagnose(null);
    setImpression(null);
    setClick(null);
  }, [platform]);

  async function call(path: string, init?: RequestInit): Promise<StepResult> {
    const res = await fetch(`${engineUrl}${path}`, {
      ...init,
      headers: {
        "X-Ad-Engine-Key": apiKey,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep as text */
    }
    return { status: res.status, ok: res.ok, body };
  }

  async function runServe() {
    const q = new URLSearchParams({
      platform: slug,
      placement,
      userRole,
    }).toString();
    setServe(await call(`/api/ads/serve?${q}`));
  }
  async function runDiagnose() {
    const q = new URLSearchParams({ platform: slug, placement }).toString();
    setDiagnose(await call(`/api/ads/diagnose?${q}`));
  }
  async function runImpression() {
    const ad = (serve?.body as { ad?: Record<string, string> } | null)?.ad;
    if (!ad) {
      setImpression({
        status: 0,
        ok: false,
        body: "Run Serve first — need an ad payload.",
      });
      return;
    }
    setImpression(
      await call("/api/ads/impression", {
        method: "POST",
        body: JSON.stringify({
          campaignId: ad.campaignId,
          creativeId: ad.creativeId,
          placementId: ad.placementId,
          platform: slug,
          userRole,
        }),
      }),
    );
  }
  async function runClick() {
    const ad = (serve?.body as { ad?: Record<string, string> } | null)?.ad;
    if (!ad) {
      setClick({ status: 0, ok: false, body: "Run Serve first." });
      return;
    }
    setClick(
      await call("/api/ads/click", {
        method: "POST",
        body: JSON.stringify({
          campaignId: ad.campaignId,
          creativeId: ad.creativeId,
          placementId: ad.placementId,
          platform: slug,
        }),
      }),
    );
  }
  async function runAll() {
    await runServe();
    await runDiagnose();
    await runImpression();
    await runClick();
  }

  return (
    <div className="space-y-6">
      <div className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">Platform</label>
          <select
            className="input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          >
            {platforms.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Placement</label>
          <select
            className="input"
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
          >
            {(platform?.placements ?? []).map((p) => (
              <option key={p.id} value={p.placementKey}>
                {p.name} ({p.placementKey})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">User Role</label>
          <input
            className="input"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
          />
        </div>
        <div>
          <label className="label">API Key (paste the platform key)</label>
          <input
            className="input font-mono text-xs"
            placeholder="cae_live_…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={runAll} disabled={!apiKey}>
          Run all checks
        </button>
        <button className="btn-secondary" onClick={runServe} disabled={!apiKey}>
          1 · Serve
        </button>
        <button className="btn-secondary" onClick={runDiagnose} disabled={!apiKey}>
          2 · Diagnose
        </button>
        <button className="btn-secondary" onClick={runImpression} disabled={!apiKey}>
          3 · Impression
        </button>
        <button className="btn-secondary" onClick={runClick} disabled={!apiKey}>
          4 · Click
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">1 · GET /api/ads/serve</div>
            <StatusPill r={serve} />
          </div>
          <Result r={serve} />
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              2 · GET /api/ads/diagnose
            </div>
            <StatusPill r={diagnose} />
          </div>
          <Result r={diagnose} />
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              3 · POST /api/ads/impression
            </div>
            <StatusPill r={impression} />
          </div>
          <Result r={impression} />
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">4 · POST /api/ads/click</div>
            <StatusPill r={click} />
          </div>
          <Result r={click} />
        </div>
      </div>

      {apiKey && placement && (
        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">
            Live preview (uses the same plugin host apps use)
          </div>
          <AdSlot
            engineUrl={engineUrl}
            apiKey={apiKey}
            platform={slug}
            placement={placement}
            userRole={userRole}
            debug
          />
        </div>
      )}
    </div>
  );
}
