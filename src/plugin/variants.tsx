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

/**
 * Tall vertical skyscraper unit (180x600). Defaults to a 180/600 aspect ratio
 * and 180px max width so the creative keeps its skyscraper shape but still
 * scales fluidly within smaller containers.
 */
export function SkyscraperAd({
  aspectRatio = "180/600",
  maxWidth = 180,
  ...rest
}: PresetProps) {
  return (
    <AdSlot
      {...rest}
      variant="banner"
      aspectRatio={aspectRatio}
      maxWidth={maxWidth}
    />
  );
}
