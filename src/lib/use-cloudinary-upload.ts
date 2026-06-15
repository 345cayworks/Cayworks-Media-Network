"use client";

import { useState } from "react";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

export type UploadResult = {
  url: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
};

/**
 * Tiny client hook around Cloudinary's unsigned upload endpoint. Shared by
 * <MediaUpload /> and <DropToAttach />; everything else stays in the caller.
 */
export function useCloudinaryUpload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = CLOUD.length > 0 && PRESET.length > 0;

  async function upload(file: File): Promise<UploadResult | null> {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", PRESET);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`,
        { method: "POST", body: fd },
      );
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const json = (await res.json()) as {
        secure_url?: string;
        resource_type?: string;
        width?: number;
        height?: number;
      };
      if (!json.secure_url) throw new Error("No URL returned by Cloudinary");
      return {
        url: json.secure_url,
        kind: json.resource_type === "video" ? "video" : "image",
        width: json.width,
        height: json.height,
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { upload, busy, error, ready };
}
