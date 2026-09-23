import { readSettings } from "@printcast/db";
import { database } from "../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    readSettings(database());
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
