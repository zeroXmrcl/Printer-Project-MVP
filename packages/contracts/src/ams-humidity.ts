import { num, text, type Json } from "./json";

export type AmsGrade = "A" | "B" | "C" | "D" | "E";
export type AmsGradeSource = "percent" | "index_inverted";

export type AmsClimate = {
  model: string | null;
  temperatureC: number | null;
  humidityPercent: number | null;
  humidityIndexMqtt: number | null;
  humidityIndexStudio: number | null;
  grade: AmsGrade | null;
  gradeSource: AmsGradeSource | null;
};

/** Bits 0–3 of ams.ams[].info (Bambu DevFilaSystemParser). */
const AMS_MODELS: Record<number, string> = {
  1: "AMS",
  2: "AMS Lite",
  3: "AMS 2 Pro",
  4: "AMS HT",
};

const LETTERS = "ABCDE";
const PERCENT_MODELS = new Set(["AMS 2 Pro", "AMS HT"]);

export function amsUnitModel(info: unknown): string {
  const infoText = text(info);
  if (infoText && /^[0-9a-fA-F]+$/.test(infoText)) {
    const model = Number.parseInt(infoText, 16) & 0x0f;
    if (AMS_MODELS[model]) return AMS_MODELS[model];
  }
  return "AMS";
}

/** Humidity index, percent, and A–E grade for one AMS unit. Null unit → all null. */
export function readAmsClimate(unit: Record<string, Json> | null): AmsClimate {
  if (!unit) {
    return {
      model: null,
      temperatureC: null,
      humidityPercent: null,
      humidityIndexMqtt: null,
      humidityIndexStudio: null,
      grade: null,
      gradeSource: null,
    };
  }

  const humidityIndexMqtt = indexMqtt(unit.humidity);
  const humidityPercent = percentRh(unit.humidity_raw, humidityIndexMqtt);
  const model = amsUnitModel(unit.info);
  const humidityIndexStudio = humidityIndexMqtt === null ? null : 6 - humidityIndexMqtt;
  const graded = gradeClimate(model, humidityPercent, humidityIndexMqtt);

  return {
    model,
    temperatureC: num(unit.temp),
    humidityPercent,
    humidityIndexMqtt,
    humidityIndexStudio,
    grade: graded.grade,
    gradeSource: graded.gradeSource,
  };
}

function indexMqtt(value: unknown): number | null {
  const parsed = num(value);
  if (parsed === null) return null;
  const index = Math.trunc(parsed);
  if (index < 1 || index > 5) return null;
  return index;
}

function percentRh(raw: unknown, mqttIndex: number | null): number | null {
  const parsed = num(raw);
  if (parsed === null) return null;
  const percent = Math.trunc(parsed);
  if (percent < 0 || percent > 100) return null;
  // Early firmware copied the 1–5 index into humidity_raw. That is not a percent.
  if (mqttIndex !== null && percent >= 1 && percent <= 5) return null;
  return percent;
}

function gradeClimate(
  model: string,
  humidityPercent: number | null,
  humidityIndexMqtt: number | null,
): { grade: AmsGrade | null; gradeSource: AmsGradeSource | null } {
  if (PERCENT_MODELS.has(model) && humidityPercent !== null) {
    return { grade: gradeFromPercent(humidityPercent), gradeSource: "percent" };
  }
  if (humidityIndexMqtt !== null) {
    // MQTT humidity is 1=wet … 5=dry. Studio A–E is the inverse. See ha-bambulab: 6 - humidity_index
    const studioLevel = 6 - humidityIndexMqtt;
    return { grade: LETTERS[studioLevel - 1] as AmsGrade, gradeSource: "index_inverted" };
  }
  return { grade: null, gradeSource: null };
}

function gradeFromPercent(rh: number): AmsGrade {
  if (rh <= 20) return "A";
  if (rh <= 30) return "B";
  if (rh <= 40) return "C";
  if (rh <= 55) return "D";
  return "E";
}
