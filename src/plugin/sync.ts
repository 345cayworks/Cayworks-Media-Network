/**
 * Push this host's full placement manifest to the engine. Call once at
 * deploy time (e.g. in a postbuild script) so the engine's AdPlacement
 * rows stay in lockstep with the slots the host actually exposes.
 *
 * Auth: the host's platform API key.
 *
 * Returns the engine's reconciliation summary: which placement keys it
 * created, which it updated, and which exist on the engine but aren't in
 * the manifest. Pass { prune: true } to auto-deactivate the stale set on
 * the engine; otherwise stale is informational only.
 */

export type PlacementType =
  | "BANNER"
  | "SIDEBAR"
  | "CARD"
  | "NATIVE"
  | "VIDEO"
  | "SKYSCRAPER";

export type PlacementManifestEntry = {
  key: string;
  name: string;
  type: PlacementType;
  description?: string;
  allowedSizes?: string[];
};

export type SyncResult = {
  ok: boolean;
  platform?: string;
  synced?: string;
  pruned?: boolean;
  created: string[];
  updated: string[];
  stale: string[];
  error?: string;
};

export async function syncPlacements(
  cfg: { engineUrl: string; apiKey: string; platform: string },
  placements: PlacementManifestEntry[],
  opts: { prune?: boolean } = {},
): Promise<SyncResult> {
  const url = new URL("/api/platforms/sync-placements", cfg.engineUrl);
  if (opts.prune) url.searchParams.set("prune", "1");

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ad-Engine-Key": cfg.apiKey,
      },
      body: JSON.stringify({ platform: cfg.platform, placements }),
    });
    const body = (await res.json().catch(() => ({}))) as Partial<SyncResult>;
    if (!res.ok) {
      return {
        ok: false,
        created: [],
        updated: [],
        stale: [],
        error: body.error ?? `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      platform: body.platform,
      synced: body.synced,
      pruned: body.pruned,
      created: body.created ?? [],
      updated: body.updated ?? [],
      stale: body.stale ?? [],
    };
  } catch (e) {
    return {
      ok: false,
      created: [],
      updated: [],
      stale: [],
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}
