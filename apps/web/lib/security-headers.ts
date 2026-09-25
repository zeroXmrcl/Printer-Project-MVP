export function streamOrigin(streamUrl: string | null | undefined): string | null {
  const trimmed = streamUrl?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function securityHeaders(https: boolean, streamUrl?: string | null): Record<string, string> {
  const origin = streamOrigin(streamUrl);
  const connect = origin ? `connect-src 'self' ${origin}` : "connect-src 'self'";
  const media = origin ? `media-src 'self' blob: ${origin}` : "media-src 'self' blob:";
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      connect,
      media,
    ].join("; "),
  };
  if (https) headers["Strict-Transport-Security"] = "max-age=15552000";
  return headers;
}
