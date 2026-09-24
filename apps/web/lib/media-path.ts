export function safeMediaParts(parts: string[]): boolean {
  if (!parts.length) return false;
  return parts.every((part) => part.length > 0 && part !== "." && part !== ".." && !part.includes("\0") && !part.includes("/") && !part.includes("\\"));
}

export function safePhotoName(name: string): boolean {
  return name.length > 0 && name.length <= 180 && /^[A-Za-z0-9._-]+$/.test(name) && !name.includes("..");
}
