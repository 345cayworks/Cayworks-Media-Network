"use client";

import { useRef, useState } from "react";

type Props = {
  label: string;
  name: string;
  kind: "image" | "video";
  defaultValue?: string | null;
  hint?: string;
};

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

/**
 * URL field + direct file upload. If Cloudinary env is configured, picking a
 * file does an unsigned browser upload and writes the resulting secure URL
 * into the field (which is what the form submits). Pasting a URL — a
 * Cloudinary delivery link, a YouTube link for video, etc. — still works.
 */
export function MediaUpload({ label, name, kind, defaultValue, hint }: Props) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cloudinaryReady = CLOUD.length > 0 && PRESET.length > 0;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
      const json = (await res.json()) as { secure_url?: string };
      if (!json.secure_url) throw new Error("No URL returned by Cloudinary");
      setValue(json.secure_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          kind === "video"
            ? "Paste a YouTube or Cloudinary video URL, or upload"
            : "Paste an image URL, or upload"
        }
      />

      <div className="mt-2 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={kind === "video" ? "video/*" : "image/*"}
          onChange={onPick}
          disabled={!cloudinaryReady || busy}
          className="text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
        />
        {busy && <span className="text-xs text-slate-500">Uploading…</span>}
      </div>

      {!cloudinaryReady && (
        <p className="mt-1 text-xs text-amber-600">
          Direct upload disabled — set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and
          NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to enable. You can still paste a
          URL.
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {value && kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="preview"
          className="mt-2 max-h-32 rounded border border-slate-200"
        />
      )}
    </div>
  );
}
