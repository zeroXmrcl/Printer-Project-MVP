export type PathConfig = Record<string, unknown>;

export function shouldPublish(state: string, alwaysShow: boolean): boolean {
  const current = state.toUpperCase();
  return alwaysShow || current === "PREPARE" || current === "RUNNING" || current === "PAUSE";
}

export type ReconcileInput = {
  apiUrl: string;
  pathName: string;
  username: string;
  password: string;
  publish: boolean;
  loadSaved: () => PathConfig | null;
  saveConfig: (config: PathConfig) => void;
  fetchImpl?: typeof fetch;
};

export type ReconcileResult = "skipped" | "removed" | "restored" | "present" | "absent" | "no-saved-config";

function endpoint(apiUrl: string, pathName: string, action: "get" | "delete" | "add"): string {
  const base = apiUrl.replace(/\/$/, "");
  const name = encodeURIComponent(pathName);
  if (action === "get") return `${base}/v3/config/paths/get/${name}`;
  if (action === "delete") return `${base}/v3/config/paths/delete/${name}`;
  return `${base}/v3/config/paths/add/${name}`;
}

function headers(username: string, password: string, json: boolean): Headers {
  const result = new Headers();
  if (username !== "" || password !== "") {
    result.set("Authorization", `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`);
  }
  if (json) result.set("Content-Type", "application/json");
  return result;
}

export async function reconcilePrinterPath(input: ReconcileInput): Promise<ReconcileResult> {
  const apiUrl = input.apiUrl.trim();
  if (apiUrl === "") return "skipped";
  const fetchImpl = input.fetchImpl ?? fetch;
  const get = await fetchImpl(endpoint(apiUrl, input.pathName, "get"), {
    headers: headers(input.username, input.password, false),
  });
  if (input.publish) {
    if (get.ok) return "present";
    if (get.status !== 404) throw new Error(`mediamtx get ${get.status}`);
    const saved = input.loadSaved();
    if (!saved) return "no-saved-config";
    const added = await fetchImpl(endpoint(apiUrl, input.pathName, "add"), {
      method: "POST",
      headers: headers(input.username, input.password, true),
      body: JSON.stringify(saved),
    });
    if (added.ok || added.status === 400) return "restored";
    throw new Error(`mediamtx add ${added.status}`);
  }
  if (get.status === 404) return "absent";
  if (!get.ok) throw new Error(`mediamtx get ${get.status}`);
  const config = (await get.json()) as PathConfig;
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("mediamtx config");
  input.saveConfig(config);
  const removed = await fetchImpl(endpoint(apiUrl, input.pathName, "delete"), {
    method: "DELETE",
    headers: headers(input.username, input.password, false),
  });
  if (removed.ok || removed.status === 404) return "removed";
  throw new Error(`mediamtx delete ${removed.status}`);
}
