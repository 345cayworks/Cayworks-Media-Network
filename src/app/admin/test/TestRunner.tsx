"use client";

import { useEffect, useMemo, useState } from "react";
import { AdSlot } from "@/plugin/AdSlot";
import { resolveVideo } from "@/plugin/client";

type Placement = { id: string; placementKey: string; name: string };
type PlatformLite = {
  slug: string;
  name: string;
  placements: Placement[];
};

type StepResult = { status: number; ok: boolean; body: unknown };

type Mode = "admin" | "host";

// Common role values across the Cayworks platforms. The input is a datalist
// so any custom role can still be typed.
const ROLE_SUGGESTIONS = [
  "MEMBER",
  "LANDLORD",
  "TENANT",
  "PROPERTY_MANAGER",
  "VENDOR",
  "ADMIN",
  "USER",
  "GUEST",
  "STAFF",
];

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

type ServedAd = {
  adId: string;
  campaignId: string;
  creativeId: string;
  placementId: string;
  creativeType: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  destinationUrl: string;
  ctaText: string | null;
  label: string;
};

/** Static preview card used in admin mode (no API key in scope to mount <AdSlot>). */
function AdminPreview({ ad }: { ad: ServedAd }) {
  const video = resolveVideo(ad.videoUrl);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
        {ad.label}
      </div>
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt={ad.title}
          className="mb-2 max-h-48 w-full rounded object-cover"
        />
      )}
      {video?.type === "youtube" && (
        <iframe
          src={video.embedSrc}
          title={ad.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="mb-2 aspect-video w-full rounded"
        />
      )}
      {video?.type === "file" && (
        <video
          src={video.src}
          controls
          playsInline
          className="mb-2 max-h-48 w-full rounded"
        />
      )}
      <div className="font-semibold text-slate-900">{ad.title}</div>
      {ad.description && (
        <p className="mt-1 text-sm text-slate-600">{ad.description}</p>
      )}
      <a
        href={ad.destinationUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="btn-primary mt-3"
      >
        {ad.ctaText ?? "Learn more"}
      </a>
    </div>
  );
}

export function TestRunner({
  engineUrl,
  platforms,
}: {
  engineUrl: string;
  platforms: PlatformLite[];
}) {
  const [mode, setMode] = useState<Mode>("admin");
  const [slug, setSlug] = useState(platforms[0]?.slug ?? "");
  const platform = useMemo(
    () => platforms.find((p) => p.slug === slug),
    [platforms, slug],
  );
  const [placement, setPlacement] = useState(
    platform?.placements[0]?.placementKey ?? "",
  );
  const [userRole, setUserRole] = useState("MEMBER");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

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

  const adminPaths = {
    serve: "/api/admin/preview/serve",
    diagnose: "/api/admin/preview/diagnose",
    impression: "/api/admin/preview/impression",
    click: "/api/admin/preview/click",
  };
  const hostPaths = {
    serve: "/api/ads/serve",
    diagnose: "/api/ads/diagnose",
    impression: "/api/ads/impression",
    click: "/api/ads/click",
  };
  const paths = mode === "admin" ? adminPaths : hostPaths;

  const ready = mode === "admin" ? true : apiKey.trim().length > 0;

  async function call(path: string, init?: RequestInit): Promise<StepResult> {
    const headers: Record<string, string> = {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    };
    if (mode === "host") headers["X-Ad-Engine-Key"] = apiKey;
    const res = await fetch(`${engineUrl}${path}`, {
      ...init,
      credentials: "include", // admin mode uses the session cookie
      headers: { ...headers, ...(init?.headers ?? {}) },
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
    const q = new URLSearchParams({ platform: slug, placement, userRole }).toString();
    setServe(await call(`${paths.serve}?${q}`));
  }
  async function runDiagnose() {
    const q = new URLSearchParams({ platform: slug, placement }).toString();
    setDiagnose(await call(`${paths.diagnose}?${q}`));
  }
  async function runImpression() {
    const ad = (serve?.body as { ad?: Record<string, string> } | null)?.ad;
    if (!ad) {
      setImpression({ status: 0, ok: false, body: "Run Serve first." });
      return;
    }
    setImpression(
      await call(paths.impression, {
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
      await call(paths.click, {
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

  const servedAd =
    (serve?.body as { ad?: ServedAd } | null)?.ad ?? null;

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="card flex flex-wrap items-center gap-3 p-3 text-sm">
        <span className="font-semibold text-slate-700">Mode:</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {(
            [
              { v: "admin", label: "Admin (no key needed)" },
              { v: "host", label: "Host (paste API key)" },
            ] as const
          ).map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMode(m.v)}
              className={
                mode === m.v
                  ? "rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              }
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {mode === "admin"
            ? "Uses your admin session — the raw API key is never required (and isn't recoverable since it's hashed)."
            : "Mirrors how a host app calls the engine. Paste the platform's raw key (regenerate in /admin/platforms if lost)."}
        </span>
      </div>

      {/* Inputs */}
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
            list="cae-roles"
            className="input"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            placeholder="MEMBER"
          />
          <datalist id="cae-roles">
            {ROLE_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">
            API Key{" "}
            <span className="font-normal normal-case text-slate-400">
              {mode === "admin" ? "(not required)" : "(masked)"}
            </span>
          </label>
          <div className="flex gap-1">
            <input
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              disabled={mode === "admin"}
              placeholder={mode === "admin" ? "—" : "cae_live_…"}
              className="input font-mono text-xs disabled:bg-slate-50 disabled:text-slate-400"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowKey((s) => !s)}
              disabled={mode === "admin"}
              title={showKey ? "Hide" : "Show"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={runAll} disabled={!ready}>
          Run all checks
        </button>
        <button className="btn-secondary" onClick={runServe} disabled={!ready}>
          1 · Serve
        </button>
        <button className="btn-secondary" onClick={runDiagnose} disabled={!ready}>
          2 · Diagnose
        </button>
        <button className="btn-secondary" onClick={runImpression} disabled={!ready}>
          3 · Impression
        </button>
        <button className="btn-secondary" onClick={runClick} disabled={!ready}>
          4 · Click
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">1 · Serve</div>
            <StatusPill r={serve} />
          </div>
          <Result r={serve} />
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">2 · Diagnose</div>
            <StatusPill r={diagnose} />
          </div>
          <Result r={diagnose} />
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">3 · Impression</div>
            <StatusPill r={impression} />
          </div>
          <Result r={impression} />
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">4 · Click</div>
            <StatusPill r={click} />
          </div>
          <Result r={click} />
        </div>
      </div>

      {/* Live preview */}
      <div className="card p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">
          Live preview
        </div>
        {mode === "host" && apiKey && placement ? (
          <AdSlot
            engineUrl={engineUrl}
            apiKey={apiKey}
            platform={slug}
            placement={placement}
            userRole={userRole}
            debug
          />
        ) : servedAd ? (
          <AdminPreview ad={servedAd} />
        ) : (
          <div className="text-xs text-slate-400">
            Run “1 · Serve” to render a preview.
          </div>
        )}
      </div>
    </div>
  );
}
