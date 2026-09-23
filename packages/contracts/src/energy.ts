export type PowerMains = { maxW: number; steadyPlaW: number };

export type PowerModel = {
  sources: string[];
  mains: { "220": PowerMains; "110": PowerMains };
  standbyW: number;
  standbyNote: string;
  ams2Pro: { standbyW: number; workingW: number; dryingW: number };
  bedHeatHysteresisC: number;
  notModeled: string[];
  rules: string;
};

export type EnergyEstimate = {
  watts: number | null;
  basis: "bed-heat" | "pla-steady" | "standby" | "unavailable";
  amsWatts: number;
  mains: "220" | "110" | null;
};

const ACTIVE = new Set(["PREPARE", "RUNNING", "PAUSE"]);

export function estimateWatts(
  print: Record<string, unknown>,
  model: PowerModel | null,
  mains: string | undefined,
): EnergyEstimate {
  if (!model) {
    return { watts: null, basis: "unavailable", amsWatts: 0, mains: null };
  }
  const band = mains === "110" ? model.mains["110"] : mains === "220" || mains === undefined ? model.mains["220"] : null;
  const selected = mains === "110" ? "110" : mains === "220" || mains === undefined ? "220" : null;
  if (!band || !selected) {
    return { watts: null, basis: "unavailable", amsWatts: 0, mains: null };
  }

  const bed = numberField(print.bed_temper);
  const bedTarget = numberField(print.bed_target_temper ?? print.bed_temper_target);
  const heatingBed =
    bedTarget !== null &&
    bedTarget > 0 &&
    bed !== null &&
    bed + model.bedHeatHysteresisC < bedTarget;

  const amsWatts = heatingBed ? 0 : amsAddon(print, model);
  if (heatingBed) {
    return { watts: band.maxW, basis: "bed-heat", amsWatts: 0, mains: selected };
  }

  const state = String(print.gcode_state ?? "").toUpperCase();
  const printerW = ACTIVE.has(state) ? band.steadyPlaW : model.standbyW;
  const basis = ACTIVE.has(state) ? "pla-steady" : "standby";
  const watts = Math.min(band.maxW, round1(printerW + amsWatts));
  return { watts, basis, amsWatts, mains: selected };
}

export function energySentence(estimate: EnergyEstimate): string {
  if (estimate.watts === null) {
    return "No published power table is loaded, so this page shows no watts.";
  }
  const ams =
    estimate.amsWatts > 0
      ? ` AMS adds ${estimate.amsWatts} W from the AMS 2 Pro table.`
      : "";
  if (estimate.basis === "bed-heat") {
    return `The bed is below its target, so this uses the published ${estimate.mains} V maximum. Fan speed and the chamber light are not in the published tables.${ams}`;
  }
  if (estimate.basis === "pla-steady") {
    return `Heaters are at temperature. This uses the published PLA steady-state power on ${estimate.mains} V, including when the filament is not PLA.${ams}`;
  }
  return `The printer is outside the heating and printing bands. This uses the published Wi-Fi standby power.${ams}`;
}

function amsAddon(print: Record<string, unknown>, model: PowerModel): number {
  const ams = amsRoot(print);
  if (!ams) return 0;
  const unit = firstUnit(ams);
  const dryTime = numberField(unit?.dry_time) ?? 0;
  if (dryTime > 0) return model.ams2Pro.dryingW;
  const now = numberField(ams.tray_now);
  const target = numberField(ams.tray_tar);
  if (now !== null && target !== null && target !== 255 && target !== now) {
    return model.ams2Pro.workingW;
  }
  return model.ams2Pro.standbyW;
}

function amsRoot(print: Record<string, unknown>): Record<string, unknown> | null {
  const ams = print.ams;
  if (!ams || typeof ams !== "object" || Array.isArray(ams)) return null;
  const record = ams as Record<string, unknown>;
  const units = record.ams;
  if (!Array.isArray(units) || units.length === 0) return null;
  return record;
}

function firstUnit(ams: Record<string, unknown>): Record<string, unknown> | null {
  const units = ams.ams;
  if (!Array.isArray(units) || !units[0] || typeof units[0] !== "object") return null;
  return units[0] as Record<string, unknown>;
}

function numberField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function integrateWh(samples: { at: number; watts: number | null }[], until: number): number | null {
  const points = samples.filter((sample) => sample.watts !== null && Number.isFinite(sample.watts));
  if (points.length === 0) return null;
  let wh = 0;
  const capMs = 5 * 60 * 1000;
  for (let i = 1; i < points.length; i += 1) {
    const dt = Math.min(Math.max(0, points[i].at - points[i - 1].at), capMs);
    wh += (dt / 3_600_000) * (points[i - 1].watts as number);
  }
  const last = points[points.length - 1];
  if (until > last.at) {
    const dt = Math.min(until - last.at, 60_000);
    wh += (dt / 3_600_000) * (last.watts as number);
  }
  return wh;
}
