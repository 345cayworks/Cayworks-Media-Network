"use client";

import { useEffect, useState } from "react";
import { AdSlot } from "./AdSlot";

type Status = "idle" | "running" | "ok" | "fail";

type Check = {
  label: string;
  status: Status;
  detail?: string;
};

/**
 * Drop-in integration verifier for host apps (ASI Cayman, CayRentManager,
 * etc.). Place it on any page during rollout — it runs the same network
 * round-trips your <AdSlot> uses and shows exactly which step works.
 *
 * Remove (or gate behind a feature flag) before going to production.
 */
export function AdEngineTester(props: {
  engineUrl: string;
  apiKey: string;
  platform: string;
  placement: string;
  userRole?: string;
}) {
  const { engineUrl, apiKey, platform, placement, userRole } = props;
  const [checks, setChecks] = useState<Check[]>([
    { label: "Env config", status: "idle" },
    { label: "GET /api/ads/serve", status: "idle" },
    { label: "GET /api/ads/diagnose", status: "idle" },
    { label: "Live <AdSlot> mount", status: "idle" },
  ]);

  function set(i: number, patch: Partial<Check>) {
    setChecks((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // 1) Env config sanity
      const envProblems: string[] = [];
      if (!engineUrl) envProblems.push("engineUrl is empty");
      else if (!/^https?:\/\//.test(engineUrl))
        envProblems.push("engineUrl is not an http(s) URL");
      if (!apiKey) envProblems.push("apiKey is empty");
      if (!platform) envProblems.push("platform is empty");
      if (!placement) envProblems.push("placement is empty");
      if (envProblems.length) {
        set(0, { status: "fail", detail: envProblems.join("; ") });
        return;
      }
      set(0, {
        status: "ok",
        detail: `engine=${engineUrl}  platform=${platform}  placement=${placement}  key=${apiKey.slice(0, 10)}…`,
      });

      // 2) Serve
      try {
        const q = new URLSearchParams({
          platform,
          placement,
          ...(userRole ? { userRole } : {}),
        }).toString();
        const res = await fetch(`${engineUrl}/api/ads/serve?${q}`, {
          headers: { "X-Ad-Engine-Key": apiKey },
        });
        const body = await safeJson(res);
        if (cancelled) return;
        if (!res.ok) {
          set(1, {
            status: "fail",
            detail: `${res.status} ${(body as { error?: string })?.error ?? ""}`,
          });
        } else if (!(body as { ad?: unknown })?.ad) {
          set(1, {
            status: "fail",
            detail: "200 but ad:null — placement has no eligible campaign",
          });
        } else {
          const ad = (body as { ad: { creativeType: string; title: string } }).ad;
          set(1, {
            status: "ok",
            detail: `${ad.creativeType} · "${ad.title}"`,
          });
        }
      } catch (err) {
        set(1, {
          status: "fail",
          detail: err instanceof Error ? err.message : "network error",
        });
      }

      // 3) Diagnose (additional context)
      try {
        const q = new URLSearchParams({ platform, placement }).toString();
        const res = await fetch(`${engineUrl}/api/ads/diagnose?${q}`, {
          headers: { "X-Ad-Engine-Key": apiKey },
        });
        const body = (await safeJson(res)) as {
          ok?: boolean;
          eligibleCampaigns?: number;
          stage?: string;
          reason?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          set(2, {
            status: "fail",
            detail: `${res.status} ${body?.reason ?? ""}`,
          });
        } else if (body?.ok) {
          set(2, {
            status: "ok",
            detail: `${body.eligibleCampaigns} eligible campaign(s)`,
          });
        } else {
          set(2, {
            status: "fail",
            detail: `${body.stage}: ${body.reason ?? "no eligible campaign"}`,
          });
        }
      } catch (err) {
        set(2, {
          status: "fail",
          detail: err instanceof Error ? err.message : "network error",
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [engineUrl, apiKey, platform, placement, userRole]);

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        background: "#fff",
        borderRadius: 10,
        padding: 14,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 13,
        color: "#0f172a",
        maxWidth: 640,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Cayworks Ad Engine — integration tester
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {checks.map((c, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "6px 0",
              borderTop: i ? "1px solid #f1f5f9" : "none",
            }}
          >
            <span style={iconStyle(c.status)}>{iconFor(c.status)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{c.label}</div>
              {c.detail && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {c.detail}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 10 }}>
        <div
          style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}
        >
          Live slot (with debug):
        </div>
        <AdSlot
          engineUrl={engineUrl}
          apiKey={apiKey}
          platform={platform}
          placement={placement}
          userRole={userRole}
          debug
        />
      </div>
    </div>
  );
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function iconFor(s: Status): string {
  if (s === "ok") return "✓";
  if (s === "fail") return "✕";
  if (s === "running") return "…";
  return "•";
}
function iconStyle(s: Status): React.CSSProperties {
  const map: Record<Status, string> = {
    ok: "#10b981",
    fail: "#ef4444",
    running: "#f59e0b",
    idle: "#94a3b8",
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    borderRadius: 999,
    fontSize: 11,
    color: "#fff",
    background: map[s],
    flexShrink: 0,
    marginTop: 1,
  };
}
