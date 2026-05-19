/**
 * Validate an ad click destination before redirecting a user to it.
 * Only absolute http(s) URLs are allowed; everything else is rejected to
 * prevent open-redirect / javascript: / data: abuse.
 */
export function sanitizeDestination(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return url.toString();
}
