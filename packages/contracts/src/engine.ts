import { estimateWatts, type PowerModel } from "./energy";
import { mergeFields, num, text, type Json } from "./json";
import { readChamberTemp } from "./view";

export type JobRecord = {
  id: string;
  filename: string | null;
  openedAt: number;
  closedAt: number | null;
  result: string;
  lastPercent: number | null;
  lastLayer: number | null;
  lastTotalLayers: number | null;
};

export type SampleRecord = {
  jobId: string;
  at: number;
  reason: "state" | "telemetry";
  nozzle: number | null;
  nozzleTarget: number | null;
  bed: number | null;
  bedTarget: number | null;
  chamber: number | null;
  percent: number | null;
  layer: number | null;
  partFan: number | null;
  auxFan: number | null;
  heatbreakFan: number | null;
  watts: number | null;
  gcodeState: string | null;
};

export type Engine = {
  print: Record<string, Json>;
  receivedAt: number | null;
  pushallAt: number | null;
  job: JobRecord | null;
  lastTelemetryAt: number | null;
  signature: string;
};

export type Effect =
  | { type: "status" }
  | { type: "job-open"; job: JobRecord }
  | { type: "job-update"; job: JobRecord }
  | { type: "job-close"; job: JobRecord }
  | { type: "sample"; sample: SampleRecord };

const TELEMETRY_MS = 5_000;
const CANCEL_ERROR = 50348044;

export function emptyEngine(): Engine {
  return {
    print: {},
    receivedAt: null,
    pushallAt: null,
    job: null,
    lastTelemetryAt: null,
    signature: "",
  };
}

export function applyReport(
  engine: Engine,
  patch: Record<string, Json>,
  now: number,
  model: PowerModel | null,
  mains: string | undefined,
  jobId: () => string = defaultJobId,
): { engine: Engine; effects: Effect[] } {
  const print = mergeFields(engine.print, patch);
  const effects: Effect[] = [{ type: "status" }];
  let job = engine.job;
  const previousState = String(engine.print.gcode_state ?? "").toUpperCase();
  const state = String(print.gcode_state ?? "").toUpperCase();
  const filename = text(print.subtask_name) ?? fileBase(text(print.gcode_file));
  const percent = num(print.mc_percent);
  const layer = num(print.layer_num);
  const totalLayers = num(print.total_layer_num);

  if (!job && state === "RUNNING") {
    job = {
      id: jobId(),
      filename,
      openedAt: now,
      closedAt: null,
      result: "RUNNING",
      lastPercent: percent,
      lastLayer: layer,
      lastTotalLayers: totalLayers,
    };
    effects.push({ type: "job-open", job });
  }

  if (job && job.closedAt === null) {
    const cancel = num(print.print_error) === CANCEL_ERROR && num(engine.print.print_error) !== CANCEL_ERROR;
    const finished = state === "FINISH" && previousState !== "FINISH";
    const failed = state === "FAILED" && previousState !== "FAILED";
    const aborted = state === "IDLE" && (previousState === "RUNNING" || previousState === "PAUSE");
    if (cancel || finished || failed || aborted) {
      job = {
        ...job,
        filename: filename ?? job.filename,
        closedAt: now,
        result: finished ? "FINISH" : failed ? "FAILED" : "ABORTED",
        lastPercent: percent ?? job.lastPercent,
        lastLayer: layer ?? job.lastLayer,
        lastTotalLayers: totalLayers ?? job.lastTotalLayers,
      };
      effects.push({ type: "job-close", job });
    } else {
      const result = state || job.result;
      job = {
        ...job,
        filename: filename ?? job.filename,
        result,
        lastPercent: percent ?? job.lastPercent,
        lastLayer: layer ?? job.lastLayer,
        lastTotalLayers: totalLayers ?? job.lastTotalLayers,
      };
      effects.push({ type: "job-update", job });
    }
  }

  const signature = stateSignature(print);
  const stateChanged = signature !== engine.signature;
  const telemetryDue = engine.lastTelemetryAt === null || now - engine.lastTelemetryAt >= TELEMETRY_MS;
  let lastTelemetryAt = engine.lastTelemetryAt;
  if (job && (stateChanged || telemetryDue || effects.some((effect) => effect.type === "job-open" || effect.type === "job-close"))) {
    const watts = estimateWatts(print, model, mains).watts;
    effects.push({
      type: "sample",
      sample: {
        jobId: job.id,
        at: now,
        reason: stateChanged ? "state" : "telemetry",
        nozzle: num(print.nozzle_temper),
        nozzleTarget: num(print.nozzle_target_temper ?? print.nozzle_temper_target),
        bed: num(print.bed_temper),
        bedTarget: num(print.bed_target_temper ?? print.bed_temper_target),
        chamber: readChamberTemp(print),
        percent,
        layer,
        partFan: num(print.cooling_fan_speed),
        auxFan: num(print.big_fan1_speed ?? print.big_fan1),
        heatbreakFan: num(print.heatbreak_fan_speed),
        watts,
        gcodeState: state || null,
      },
    });
    if (!stateChanged) lastTelemetryAt = now;
    else if (telemetryDue) lastTelemetryAt = now;
  }

  return {
    engine: { print, receivedAt: now, pushallAt: engine.pushallAt, job: job && job.closedAt === null ? job : job?.closedAt ? null : job, lastTelemetryAt, signature },
    effects,
  };
}

export function markPushall(engine: Engine, now: number): Engine {
  return { ...engine, pushallAt: now };
}

function stateSignature(print: Record<string, Json>): string {
  const ams = print.ams;
  const unit = ams && typeof ams === "object" && !Array.isArray(ams) ? (ams as Record<string, Json>).ams : null;
  const first = Array.isArray(unit) && unit[0] && typeof unit[0] === "object" ? (unit[0] as Record<string, Json>) : null;
  return JSON.stringify({
    gcode_state: print.gcode_state ?? null,
    layer_num: print.layer_num ?? null,
    stg_cur: print.stg_cur ?? null,
    print_error: print.print_error ?? null,
    hms: print.hms ?? null,
    tray_now: ams && typeof ams === "object" && !Array.isArray(ams) ? (ams as Record<string, Json>).tray_now ?? null : null,
    dry_time: first?.dry_time ?? null,
    humidity: first?.humidity ?? null,
  });
}

function fileBase(value: string | null): string | null {
  if (!value) return null;
  const parts = value.split("/");
  return parts[parts.length - 1] || value;
}

function defaultJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
