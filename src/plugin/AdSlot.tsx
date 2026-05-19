"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchAd,
  recordImpression,
  recordClick,
  type AdPayload,
  type AdEngineConfig,
} from "./client";

export type AdVariant = "banner" | "card" | "native" | "auto";

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
};

function pickVariant(v: AdVariant | undefined, ad: AdPayload): Exclude<AdVariant, "auto"> {
  if (v && v !== "auto") return v;
  if (ad.creativeType === "NATIVE") return "native";
  if (ad.creativeType === "IMAGE" && ad.imageUrl) return "banner";
  return "card";
}

export function AdSlot(props: AdSlotProps) {
  const { engineUrl, apiKey, platform, placement, userRole, category } = props;
  const cfg: AdEngineConfig = { engineUrl, apiKey, platform };

  const [ad, setAd] = useState<AdPayload | null>(null);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const impressionFired = useRef(false);

  useEffect(() => {
    let active = true;
    fetchAd(cfg, { placement, userRole, category }).then((result) => {
      if (active) {
        setAd(result);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineUrl, apiKey, platform, placement, userRole, category]);

  // Record an impression only once the ad is actually visible.
  useEffect(() => {
    if (!ad || !containerRef.current || impressionFired.current) return;
    const el = containerRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !impressionFired.current) {
            impressionFired.current = true;
            recordImpression(cfg, ad, { userRole });
            obs.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad]);

  async function onClick(e: React.MouseEvent) {
    if (!ad) return;
    e.preventDefault();
    const dest = await recordClick(cfg, ad);
    window.open(dest, "_blank", "noopener,noreferrer");
  }

  // Graceful fallback: render nothing if no ad is available.
  if (!ready || !ad) return null;

  const variant = pickVariant(props.variant, ad);

  return (
    <div
      ref={containerRef}
      className={props.className}
      data-cae-placement={placement}
    >
      <a
        href={ad.destinationUrl}
        onClick={onClick}
        rel="noopener noreferrer sponsored"
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        {variant === "banner" && <BannerAd ad={ad} />}
        {variant === "card" && <CardAd ad={ad} />}
        {variant === "native" && <NativeAdView ad={ad} />}
      </a>
    </div>
  );
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#94a3b8",
  marginBottom: 4,
};

function BannerAd({ ad }: { ad: AdPayload }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <div style={{ ...LABEL_STYLE, padding: "8px 12px 0" }}>{ad.label}</div>
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt={ad.title}
          style={{ width: "100%", display: "block" }}
        />
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

function CardAd({ ad }: { ad: AdPayload }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 14,
        background: "#fff",
        display: "flex",
        gap: 12,
      }}
    >
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt={ad.title}
          style={{
            width: 64,
            height: 64,
            objectFit: "cover",
            borderRadius: 8,
            flexShrink: 0,
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
