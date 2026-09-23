import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearLoginFailures,
  hashPassword,
  loginAllowed,
  readSession,
  recordLoginFailure,
  safeStreamUrl,
  signSession,
  verifyPassword,
} from "@printcast/contracts";
import { insertAudit, writeSettings } from "@printcast/db";
import { database } from "../../lib/store";

const dummyHash = hashPassword("printcast-dummy-password-value");

function clientIp(headerStore: Headers): string {
  return headerStore.get("cf-connecting-ip") || headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function secureCookie(headerStore: Headers): boolean {
  return headerStore.get("x-forwarded-proto") === "https";
}

async function csrfOk(formData: FormData): Promise<boolean> {
  const jar = await cookies();
  const headerStore = await headers();
  const sent = String(formData.get("csrf") ?? "");
  const cookie = jar.get("printcast_csrf")?.value ?? "";
  const header = headerStore.get("x-printcast-csrf") ?? "";
  return sent.length > 0 && sent === cookie && sent === header;
}

export async function login(formData: FormData) {
  "use server";
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  if (!(await csrfOk(formData))) redirect("/admin?error=login");
  if (!loginAllowed(ip)) {
    insertAudit(database(), "login_failure", false, "rate limit");
    redirect("/admin?error=login");
  }
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const expectedUser = process.env.ADMIN_USERNAME ?? "";
  const stored = process.env.ADMIN_PASSWORD_HASH ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  const passwordOk = verifyPassword(password, stored || dummyHash);
  if (!expectedUser || !stored || secret.length < 32 || username !== expectedUser || !passwordOk) {
    recordLoginFailure(ip);
    insertAudit(database(), "login_failure", false, "rejected");
    redirect("/admin?error=login");
  }
  clearLoginFailures(ip);
  const jar = await cookies();
  jar.set("printcast_session", signSession(username, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(headerStore),
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  insertAudit(database(), "login_success", true, "");
  redirect("/admin");
}

export async function saveDisplay(formData: FormData) {
  "use server";
  const headerStore = await headers();
  const jar = await cookies();
  const session = readSession(jar.get("printcast_session")?.value, process.env.ADMIN_SESSION_SECRET ?? "");
  if (!session) redirect("/admin?error=login");
  if (!(await csrfOk(formData))) redirect("/admin?error=login");
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "");
  const stream = safeStreamUrl(String(formData.get("streamUrl") ?? ""));
  if (!title || title.length > 80 || notes.length > 4000 || stream === null) redirect("/admin?error=form");
  writeSettings(database(), { title, notes, streamUrl: stream });
  insertAudit(database(), "display_update", true, "display");
  redirect("/admin?saved=1");
}

export async function logout() {
  "use server";
  const jar = await cookies();
  jar.set("printcast_session", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  redirect("/admin");
}
