"use client";

import { useRef, useState } from "react";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

type Uploaded = {
  url: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  filename: string;
};

/**
 * Drop or pick an image/video → uploads to Cloudinary in the browser →
 * reveals a tiny details form (Title, Destination URL, CTA) and posts via
 * the supplied server action which creates the creative and attaches it to
 * the campaign in one go. APPROVAL stays PENDING so it's queued for review.
 */
export function DropToAttach({
  action,
}: {
  /** Server action bound to createAndAttachCreative(campaignId, formData). */
  action: (formData: FormData) => void;
}) {
  const [up, setUp] = useState<Uploaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cloudinaryReady = CLOUD.length > 0 && PRESET.length > 0;

  async function upload(file: File) {
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
      const kind: "image" | "video" =
        json.resource_type === "video" ? "video" : "image";
      setUp({
        url: json.secure_url,
        kind,
        width: json.width,
        height: json.height,
        filename: file.name.replace(/\.[^.]+$/, ""),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  }

  if (!cloudinaryReady) {
    return (
      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        Direct upload disabled — set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code>
        {" "}and <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> to enable.
        You can still use the “Upload new creative” link above.
      </div>
    );
  }

  if (!up) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-8 text-center transition ${
          drag
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        }`}
      >
        <div className="text-sm font-semibold text-slate-700">
          Drop an image or video to attach a new creative
        </div>
        <div className="text-xs text-slate-500">
          Uploads straight to Cloudinary, then queues for approval.
        </div>
        <div className="mt-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            className="text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 file:shadow-sm"
          />
        </div>
        {busy && <div className="text-xs text-slate-500">Uploading…</div>}
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    );
  }

  // After upload: tiny details form, then submit -> server action creates +
  // attaches the creative to the campaign and redirects back.
  return (
    <form action={action} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {up.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={up.url}
            alt="preview"
            className="h-20 w-20 rounded object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-500">
            VIDEO
          </div>
        )}
        <div className="flex-1 text-xs text-slate-500">
          <div className="font-medium text-slate-700">Uploaded</div>
          <div className="truncate">{up.url}</div>
          {up.width && up.height && (
            <div>
              {up.width}×{up.height}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setUp(null)}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>

      {/* Hidden fields that drive the createAndAttachCreative validation. */}
      {up.kind === "image" ? (
        <input type="hidden" name="imageUrl" value={up.url} />
      ) : (
        <input type="hidden" name="videoUrl" value={up.url} />
      )}
      <input
        type="hidden"
        name="creativeType"
        value={up.kind === "image" ? "IMAGE" : "VIDEO"}
      />
      {up.width && <input type="hidden" name="width" value={up.width} />}
      {up.height && <input type="hidden" name="height" value={up.height} />}
      <input type="hidden" name="approvalStatus" value="PENDING" />
      <input type="hidden" name="status" value="ACTIVE" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={up.filename}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="destinationUrl">
            Destination URL
          </label>
          <input
            id="destinationUrl"
            name="destinationUrl"
            required
            type="url"
            placeholder="https://advertiser.example.com"
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ctaText">
            CTA Text
          </label>
          <input
            id="ctaText"
            name="ctaText"
            defaultValue="Learn more"
            className="input"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Create + attach to this campaign
        </button>
        <span className="self-center text-xs text-slate-500">
          Queues as PENDING for review.
        </span>
      </div>
    </form>
  );
}
