import fs from "node:fs";

const sourcePath = process.argv[2];
const outPath = new URL("../config/hms-map.json", import.meta.url);
const text = fs.readFileSync(sourcePath, "utf8");
const pattern =
  /HMS_([0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}):\s*([^\n]+)/g;
const entries = [];
let match = pattern.exec(text);
while (match) {
  entries.push({
    code: match[1].toUpperCase(),
    message: match[2].replace(/\*/g, "").trim(),
    index: match.index,
  });
  match = pattern.exec(text);
}

const codes = {};
for (let i = 0; i < entries.length; i += 1) {
  const entry = entries[i];
  if (codes[entry.code]) continue;
  const end = entries[i + 1] ? entries[i + 1].index : entry.index + 2500;
  const slice = text.slice(entry.index, end);
  if (!/\bP2S\b/.test(slice)) continue;
  const link = slice.match(/\/en\/[a-z0-9_./-]*hmscode\/[0-9a-z_]+/i);
  codes[entry.code] = {
    message: entry.message,
    wiki: link
      ? `https://wiki.bambulab.com${link[0]}`
      : "https://wiki.bambulab.com/en/hms/home",
  };
}

const doc = {
  source: "https://wiki.bambulab.com/en/hms/home",
  included: "Codes whose HMS index entry lists P2S before the next code.",
  severitySource:
    "https://github.com/greghesp/ha-bambulab/blob/master/custom_components/bambu_lab/pybambu/const.py",
  severityDecode:
    "Format attr and code as 8 hex digits each. Severity is (code >> 16): 1 fatal, 2 serious, 3 common, 4 info. Codes absent from this file stay hidden.",
  codes,
};

fs.mkdirSync(new URL("../config/", import.meta.url), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log(Object.keys(codes).length);
