/**
 * Media helpers shared by the admin preview and the ad plugin.
 * A creative's videoUrl may be a direct file (Cloudinary/CDN .mp4) or a
 * YouTube link — these normalize both.
 */

export type ResolvedVideo =
  | { type: "youtube"; embedSrc: string }
  | { type: "file"; src: string };

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/);
      if (m) return m[2] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveVideo(
  videoUrl: string | null | undefined,
): ResolvedVideo | null {
  if (!videoUrl) return null;
  const id = youtubeId(videoUrl);
  if (id) {
    return {
      type: "youtube",
      embedSrc: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
    };
  }
  const v = videoUrl.trim();
  if (/^https?:\/\//i.test(v)) return { type: "file", src: v };
  return null;
}
