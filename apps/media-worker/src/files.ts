export type TimelapseFile = { name: string; modifiedAt: number | null };

export function chooseTimelapse(files: TimelapseFile[], openedAt: number): TimelapseFile | null {
  const candidates = files
    .filter((file) => file.name.toLowerCase().endsWith(".mp4"))
    .filter((file) => file.modifiedAt === null || file.modifiedAt >= openedAt - 60_000)
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
  return candidates[0] ?? null;
}
