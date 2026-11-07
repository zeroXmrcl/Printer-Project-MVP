export type CinemaKind = "printing" | "paused" | "finished" | "idle" | "private" | "offline";

export type CinemaHudModel = {
  kind: CinemaKind;
  kicker: string;
  title: string;
  meta: string;
  percent: number | null;
  showBar: boolean;
  showDials: boolean;
  showMetrics: boolean;
};

export function printing(state: string): boolean {
  return state === "PREPARE" || state === "RUNNING" || state === "PAUSE";
}

function clampPercent(percent: number | null): number | null {
  if (percent === null || !Number.isFinite(percent)) return null;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function layerLine(layer: number | null, totalLayers: number | null): string | null {
  if (layer === null) return null;
  return totalLayers !== null ? `Layer ${layer} / ${totalLayers}` : `Layer ${layer}`;
}

function joinMeta(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

export function cinemaHud(input: {
  state: string;
  filename: string | null;
  percent: number | null;
  layer: number | null;
  totalLayers: number | null;
  stageLabel: string | null;
  remainingLabel: string | null;
  cameraVisible: boolean;
  streamUrl: string | null;
  chamberC: number | null;
}): CinemaHudModel {
  const percent = clampPercent(input.percent);
  const file = input.filename?.trim() || null;
  const stream = input.streamUrl?.trim() || "";
  const stage = input.stageLabel && input.stageLabel !== "-" ? input.stageLabel : null;
  const layer = layerLine(input.layer, input.totalLayers);
  const remaining = input.remainingLabel ? `about ${input.remainingLabel}` : null;
  const chamber = input.chamberC === null ? null : `Chamber ${Math.round(input.chamberC)}°`;

  if (!stream) {
    if (printing(input.state) || percent === 100) {
      return {
        kind: "offline",
        kicker: input.state === "PAUSE" ? "Paused" : percent === 100 ? "Finished" : "Printing",
        title: file ?? "Camera offline",
        meta: joinMeta([layer, stage, remaining]) || "Camera offline",
        percent,
        showBar: percent !== null,
        showDials: true,
        showMetrics: true,
      };
    }
    return {
      kind: "offline",
      kicker: "Camera",
      title: "Camera offline",
      meta: "Stream not set · scroll for the dashboard",
      percent: null,
      showBar: false,
      showDials: false,
      showMetrics: false,
    };
  }

  if (!input.cameraVisible) {
    return {
      kind: "private",
      kicker: "Idle",
      title: "Printer idle",
      meta: joinMeta([chamber, "Camera hidden until a print starts"]) || "Printer idle",
      percent: null,
      showBar: false,
      showDials: false,
      showMetrics: false,
    };
  }

  if (percent === 100 && !printing(input.state)) {
    return {
      kind: "finished",
      kicker: "Finished",
      title: file ?? "Print complete",
      meta: joinMeta([layer, stage ?? "Finished"]) || "Print complete",
      percent: 100,
      showBar: true,
      showDials: true,
      showMetrics: true,
    };
  }

  if (input.state === "PAUSE") {
    return {
      kind: "paused",
      kicker: "Paused",
      title: file ?? "Paused",
      meta: joinMeta([layer, stage, remaining]) || "Paused",
      percent,
      showBar: percent !== null,
      showDials: true,
      showMetrics: true,
    };
  }

  if (printing(input.state)) {
    return {
      kind: "printing",
      kicker: "Printing",
      title: file ?? "Printing",
      meta: joinMeta([layer, stage ?? "Printing", remaining]),
      percent,
      showBar: percent !== null,
      showDials: true,
      showMetrics: true,
    };
  }

  return {
    kind: "idle",
    kicker: "Idle",
    title: "Printer idle",
    meta: joinMeta([chamber, "Ready · scroll for the dashboard"]) || "Printer idle",
    percent: null,
    showBar: false,
    showDials: false,
    showMetrics: true,
  };
}
