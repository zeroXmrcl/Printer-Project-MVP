import { cookies, headers } from "next/headers";
import { readSession } from "@printcast/contracts";
import { SiteHeader } from "../../components/chrome";
import { login, logout, saveDisplay } from "./actions";
import { audit, settings } from "../../lib/store";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const query = await searchParams;
  const headerStore = await headers();
  const jar = await cookies();
  const session = readSession(jar.get("printcast_session")?.value, process.env.ADMIN_SESSION_SECRET ?? "");
  const csrf = headerStore.get("x-printcast-csrf") ?? "";
  const display = settings();
  const configured = Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH && (process.env.ADMIN_SESSION_SECRET ?? "").length >= 32);

  return (
    <main className="shell">
      <SiteHeader title={display.title} notes={display.notes} current="admin" />
      {!configured ? <p className="banner">Admin login is not configured.</p> : null}
      {query.error === "login" ? <p className="banner">Login failed.</p> : null}
      {query.error === "form" ? <p className="banner">Check the title, notes, and stream URL.</p> : null}
      {query.saved ? <p className="banner ok">Saved.</p> : null}
      {!session ? (
        <form className="widget pad form" action={login}>
          <div className="section-label" style={{ marginTop: 0 }}>Settings</div>
          <input type="hidden" name="csrf" value={csrf} />
          <label>Username<input name="username" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit">Log in</button>
        </form>
      ) : (
        <div className="two">
          <form className="widget pad form" action={saveDisplay}>
            <div className="kicker">Display</div>
            <input type="hidden" name="csrf" value={csrf} />
            <label>Title<input name="title" defaultValue={display.title} required maxLength={80} /></label>
            <label>Notes<textarea name="notes" defaultValue={display.notes} maxLength={4000} /></label>
            <label>Public stream URL<input name="streamUrl" defaultValue={display.streamUrl} placeholder="https://stream.example/p2s/index.m3u8" /></label>
            <button type="submit">Save</button>
          </form>
          <section className="widget">
            <div className="pad kicker">Audit</div>
            {audit().length === 0 ? <p className="pad note">No admin events yet.</p> : (
              <table className="table">
                <tbody>
                  {audit().map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.at).toLocaleString("en-GB", { hourCycle: "h23" })}</td>
                      <td>{row.action.replaceAll("_", " ")}</td>
                      <td>{row.ok ? "OK" : "Failed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <form className="pad" action={logout}><button type="submit">Log out</button></form>
          </section>
        </div>
      )}
    </main>
  );
}
