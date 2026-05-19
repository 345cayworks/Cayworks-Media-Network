"use client";

import { AdSlot, type AdSlotProps } from "./AdSlot";

type PresetProps = Omit<AdSlotProps, "variant">;

/** Full-width image banner. */
export function AdBanner(props: PresetProps) {
  return <AdSlot {...props} variant="banner" />;
}

/** Compact sponsored card with thumbnail + CTA. */
export function SponsoredCard(props: PresetProps) {
  return <AdSlot {...props} variant="card" />;
}

/** Text-first native unit that blends into surrounding content. */
export function NativeAd(props: PresetProps) {
  return <AdSlot {...props} variant="native" />;
}

/** Video unit — YouTube link renders as an embed, otherwise an HTML5 player. */
export function VideoAd(props: PresetProps) {
  return <AdSlot {...props} variant="video" />;
}
