"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchAd,
  fetchAdQueue,
  recordImpression,
  recordClick,
  resolveVideo,
  type AdPayload,
  type AdEngineConfig,
} from "./client";

const QUEUE_REFRESH_MS = 5 * 60 * 1000;

export type AdVariant = "banner" | "card" | "native" | "video" | "auto";

export type AdSlotProps = {
  /** Base URL of the Cayworks Ad Engine deployment. */
  engineUrl: string;
  /** Platform API key issued by the ad engine. */
  apiKey: string;
  /** Platform slug, e.g. "cayrentmanager". */
  platform: string;
  /** Placement key, e.g. "landlord_dashboard_top". */
  placement: string;
  userRole?: string;
  category?: string;
  variant?: AdVariant;
  className?: string;
  /**
   * How the creative fills its box when an aspect ratio / height is set.
   * "cover" fills and crops (no distortion, default), "contain" letterboxes,
   * "fill" stretches to fit exactly (may distort).
   */
  fit?: "cover" | "contain" | "fill";
  /**
   * Aspect ratio for image/video creatives, e.g. "16/9" or "728/90". When
   * omitted, the creative's own width/height are used; failing that the image
   * keeps its natural ratio. Lets the slot scale fluidly with no layout shift.
   */
  aspectRatio?: string;
  /** Fixed pixel/CSS height for the media box (overrides aspectRatio). */
  height?: number | string;
  /** Cap the slot width; otherwise it fills 100% of its container. */
  maxWidth?: number | string;
  /**
   * Enable timed rotation. When set (> 0), the slot fetches a weighted
   * rotation queue and cycles through it every `rotateSeconds` seconds.
   * Heavier-weight campaigns appear proportionally more often.
   */
  rotateSeconds?: number;
  /** Rotation queue length to request (default 12, server-capped at 20). */
  queueSize?: number;
  /**
   * When true, logs the fetch lifecycle to the console and renders a visible
   * placeholder when no ad is available — useful while wiring up a new app.
   */
  debug?: boolean;
};

function pickVariant(v: AdVariant | undefined, ad: AdPayload): Exclude<AdVariant, "auto"> {
  if (v && v !== "auto") return v;
  if (ad.videoUrl && resolveVideo(ad.videoUrl)) return "video";
  if (ad.creativeType === "NATIVE") return "native";
  if (ad.creativeType === "IMAGE" && ad.imageUrl) return "banner";
  return "card";
}

export function AdSlot(props: AdSlotProps) {
  const { engineUrl, apiKey, platform, placement, userRole, category } = props;
  const cfg: AdEngineConfig = { engineUrl, apiKey, platform };

  const rotate = (props.rotateSeconds ?? 0) > 0;
  const queueSize = props.queueSize ?? 12;

  const [ads, setAds] = useState<AdPayload[]>([]);
  const [idx, setIdx] = useState(0);
  const [ready, setReady] = useState(false);
  // Monotonic counter: increments on every distinct display (initial + each
  // rotation) so every on-screen view is counted as exactly one impression.
  const [displayKey, setDisplayKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);
  const firedKeyRef = useRef(-1);
  const adsRef = useRef<AdPayload[]>(ads);
  adsRef.current = ads;

  const current = ads.length ? ads[idx % ads.length] : null;
  const currentRef = useRef(current);
  currentRef.current = current;
  const displayKeyRef = useRef(displayKey);
  displayKeyRef.current = displayKey;

  // Initial fetch (single ad, or a rotation queue when rotate is enabled).
  useEffect(() => {
    let active = true;
    if (props.debug) {
      // eslint-disable-next-line no-console
      console.log("[AdSlot] fetching", {
        engineUrl,
        platform,
        placement,
        userRole,
        category,
        rotate,
        keyPreview: apiKey ? `${apiKey.slice(0, 10)}…` : "(empty)",
      });
    }
    async function load() {
      // Best-effort size + variant hints so the engine can auto-register
      // unknown placement keys with something useful seeded in.
      const measured = containerRef.current?.getBoundingClientRect();
      const hints = {
        variant: props.variant && props.variant !== "auto" ? props.variant : undefined,
        width: measured?.width || undefined,
        height: measured?.height || undefined,
      };
      const result = rotate
        ? await fetchAdQueue(cfg, { placement, userRole, category, ...hints }, queueSize)
        : await fetchAd(cfg, { placement, userRole, category, ...hints }).then((a) =>
            a ? [a] : [],
          );
      if (!active) return;
      if (props.debug) {
        // eslint-disable-next-line no-console
        console.log("[AdSlot] result", result.length ? result : "(no ad)");
      }
      setAds(result);
      setIdx(0);
      setReady(true);
      setDisplayKey((k) => k + 1);
    }
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineUrl, apiKey, platform, placement, userRole, category, rotate, queueSize]);

  // Rotation timer. Pauses while the tab is hidden so off-screen ads don't
  // burn impressions.
  useEffect(() => {
    if (!rotate) return;
    const ms = Math.max(2, props.rotateSeconds as number) * 1000;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (adsRef.current.length <= 1) return;
      setIdx((p) => (p + 1) % adsRef.current.length);
      setDisplayKey((k) => k + 1);
    }, ms);
    return () => clearInterval(id);
  }, [rotate, props.rotateSeconds]);

  // Periodically refresh the queue so eligibility / cap changes are picked up.
  useEffect(() => {
    if (!rotate) return;
    const id = setInterval(async () => {
      const q = await fetchAdQueue(
        cfg,
        { placement, userRole, category },
        queueSize,
      );
      if (q.length) setAds(q);
    }, QUEUE_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotate, engineUrl, apiKey, platform, placement, userRole, category, queueSize]);

  function fireIfVisible() {
    const ad = currentRef.current;
    if (!ad || !visibleRef.current) return;
    if (firedKeyRef.current === displayKeyRef.current) return;
    firedKeyRef.current = displayKeyRef.current;
    recordImpression(cfg, ad, { userRole });
  }

  // Track visibility; (re)attaches when the rendered ad changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visibleRef.current = e.isIntersecting && e.intersectionRatio >= 0.5;
          if (visibleRef.current) fireIfVisible();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, current?.creativeId]);

  // Fire an impression each time the displayed ad changes (while visible).
  useEffect(() => {
    fireIfVisible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayKey]);

  async function onClick(e: React.MouseEvent) {
    const ad = currentRef.current;
    if (!ad) return;
    e.preventDefault();
    const dest = await recordClick(cfg, ad);
    window.open(dest, "_blank", "noopener,noreferrer");
  }

  // Graceful fallback: render nothing if no ad is available.
  if (!ready || !current) {
    if (props.debug && ready) {
      return (
        <div
          style={{
            border: "1px dashed #cbd5e1",
            color: "#64748b",
            padding: 10,
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          AdSlot debug — no ad served for {platform}/{placement}. Check{" "}
          <code>/api/ads/diagnose?platform={platform}&placement={placement}</code>
          .
        </div>
      );
    }
    return null;
  }

  const variant = pickVariant(props.variant, current);

  const sizing: Sizing = {
    fit: props.fit ?? "cover",
    aspectRatio: props.aspectRatio,
    height: props.height,
  };
  // Fluid by default: fill the host container, capped by maxWidth if given.
  const wrapperStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: props.maxWidth,
  };

  // Video isn't wrapped in the anchor: an iframe/video would swallow the
  // click. It renders the player plus a tracked CTA button instead.
  if (variant === "video") {
    return (
      <div
        ref={containerRef}
        className={props.className}
        style={wrapperStyle}
        data-cae-placement={placement}
      >
        <VideoAd ad={current} sizing={sizing} onCta={(e) => onClick(e)} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={props.className}
      style={wrapperStyle}
      data-cae-placement={placement}
    >
      <a
        href={current.destinationUrl}
        onClick={onClick}
        rel="noopener noreferrer sponsored"
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        {variant === "banner" && <BannerAd ad={current} sizing={sizing} />}
        {variant === "card" && <CardAd ad={current} sizing={sizing} />}
        {variant === "native" && <NativeAdView ad={current} />}
      </a>
    </div>
  );
}

type Sizing = {
  fit: "cover" | "contain" | "fill";
  aspectRatio?: string;
  height?: number | string;
};

/** Resolve the media box + image styles for a creative given sizing rules. */
function mediaStyles(
  ad: AdPayload,
  sizing: Sizing,
): { box: React.CSSProperties; img: React.CSSProperties } {
  const ratio =
    sizing.aspectRatio ??
    (ad.width && ad.height ? `${ad.width} / ${ad.height}` : undefined);

  if (sizing.height != null) {
    return {
      box: { width: "100%", height: sizing.height },
      img: { width: "100%", height: "100%", objectFit: sizing.fit, display: "block" },
    };
  }
  if (ratio) {
    return {
      box: { width: "100%", aspectRatio: ratio },
      img: { width: "100%", height: "100%", objectFit: sizing.fit, display: "block" },
    };
  }
  // No ratio info: scale fluidly to width, natural height.
  return {
    box: { width: "100%" },
    img: { width: "100%", height: "auto", display: "block" },
  };
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#94a3b8",
  marginBottom: 4,
};

function BannerAd({ ad, sizing }: { ad: AdPayload; sizing: Sizing }) {
  const m = mediaStyles(ad, sizing);
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        width: "100%",
      }}
    >
      <div style={{ ...LABEL_STYLE, padding: "8px 12px 0" }}>{ad.label}</div>
      {ad.imageUrl && (
        <div style={m.box}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.imageUrl} alt={ad.title} style={m.img} />
        </div>
      )}
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{ad.title}</div>
        {ad.description && (
          <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
            {ad.description}
          </div>
        )}
      </div>
    </div>
  );
}

function CardAd({ ad, sizing }: { ad: AdPayload; sizing: Sizing }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 14,
        background: "#fff",
        display: "flex",
        gap: 12,
        width: "100%",
      }}
    >
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt={ad.title}
          style={{
            // Thumbnail scales a little with the card width, stays square.
            width: "clamp(56px, 22%, 96px)",
            aspectRatio: "1 / 1",
            objectFit: sizing.fit === "contain" ? "contain" : "cover",
            borderRadius: 8,
            flexShrink: 0,
            alignSelf: "flex-start",
          }}
        />
      )}
      <div>
        <div style={LABEL_STYLE}>{ad.label}</div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{ad.title}</div>
        {ad.description && (
          <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
            {ad.description}
          </div>
        )}
        {ad.ctaText && (
          <span
            style={{
              display: "inline-block",
              marginTop: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#1f6feb",
            }}
          >
            {ad.ctaText} →
          </span>
        )}
      </div>
    </div>
  );
}

function NativeAdView({ ad }: { ad: AdPayload }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <span style={LABEL_STYLE}>{ad.label}</span>
      <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>
        {ad.title}
      </div>
      {ad.description && (
        <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
          {ad.description}
        </div>
      )}
      {ad.ctaText && (
        <span
          style={{
            display: "inline-block",
            marginTop: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#1f6feb",
          }}
        >
          {ad.ctaText} →
        </span>
      )}
    </div>
  );
}

function VideoAd({
  ad,
  sizing,
  onCta,
}: {
  ad: AdPayload;
  sizing: Sizing;
  onCta: (e: React.MouseEvent) => void;
}) {
  const video = resolveVideo(ad.videoUrl);
  // Video defaults to 16/9 (overridable); fills its width responsively.
  const ratio = sizing.aspectRatio ?? "16 / 9";
  const boxRatio = sizing.height != null ? undefined : ratio;
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        width: "100%",
      }}
    >
      <div style={{ ...LABEL_STYLE, padding: "8px 12px 0" }}>{ad.label}</div>
      <div style={{ padding: "8px 12px" }}>
        {video?.type === "youtube" && (
          <iframe
            src={video.embedSrc}
            title={ad.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              width: "100%",
              height: sizing.height ?? undefined,
              aspectRatio: boxRatio,
              border: 0,
              borderRadius: 6,
              display: "block",
            }}
          />
        )}
        {video?.type === "file" && (
          <video
            src={video.src}
            controls
            playsInline
            style={{
              width: "100%",
              height: sizing.height ?? undefined,
              aspectRatio: boxRatio,
              objectFit: sizing.fit,
              borderRadius: 6,
              display: "block",
            }}
          />
        )}
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{ad.title}</div>
        {ad.description && (
          <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
            {ad.description}
          </div>
        )}
        <a
          href={ad.destinationUrl}
          onClick={onCta}
          rel="noopener noreferrer sponsored"
          style={{
            display: "inline-block",
            marginTop: 10,
            padding: "8px 14px",
            borderRadius: 6,
            background: "#1f6feb",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {ad.ctaText ?? "Learn more"}
        </a>
      </div>
    </div>
  );
}
