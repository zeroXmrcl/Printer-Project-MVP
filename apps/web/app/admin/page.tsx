import Link from "next/link";
import { cookies, headers } from "next/headers";
import { readSession } from "@printcast/contracts";
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

  if (!session) {
    return (
      <div className="admin-theme">
        <main className="admin-login">
          <section className="admin-panel">
            <div className="admin-panel-head">
              <h1>Sign In</h1>
              <p>PrintCast control panel</p>
            </div>
            <div className="admin-panel-body">
              {!configured ? (
                <div className="admin-notice warn" role="status">
                  <strong>Login unavailable</strong>
                  <p>Admin login is not configured.</p>
                </div>
              ) : null}
              {query.error === "login" ? (
                <div className="admin-notice danger" role="alert">
                  <strong>Authentication failed</strong>
                  <p>Invalid username or password, or too many attempts.</p>
                </div>
              ) : null}
              <form className="admin-form" action={login}>
                <input type="hidden" name="csrf" value={csrf} />
                <label className="admin-field">
                  <span>Username</span>
                  <input className="admin-input" name="username" autoComplete="username" required disabled={!configured} />
                </label>
                <label className="admin-field">
                  <span>Password</span>
                  <input className="admin-input" name="password" type="password" autoComplete="current-password" required disabled={!configured} />
                </label>
                <button className="admin-btn primary" type="submit" disabled={!configured}>Sign In</button>
              </form>
              <p className="admin-foot"><Link href="/">Back to dashboard</Link></p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-theme">
      <header className="admin-top">
        <div>
          <p className="admin-eyebrow">Control Panel</p>
          <h1>Display</h1>
        </div>
        <div className="admin-top-actions">
          <Link className="admin-link" href="/">Dashboard</Link>
          <form action={logout}>
            <button className="admin-btn" type="submit">Sign Out</button>
          </form>
        </div>
      </header>
      <main className="admin-main">
        {query.error === "form" ? (
          <div className="admin-notice danger" role="alert">
            <strong>Could not save</strong>
            <p>Check the title, notes, stream URL, and MediaMTX API URL.</p>
          </div>
        ) : null}
        {query.saved ? (
          <div className="admin-notice ok" role="status">
            <strong>Saved</strong>
            <p>Display settings updated.</p>
          </div>
        ) : null}
        <div className="admin-stack">
          <section className="admin-panel">
            <div className="admin-panel-head">
              <h2>Display</h2>
              <p>Title, notes, and public camera stream URL.</p>
            </div>
            <div className="admin-panel-body">
              <form className="admin-form" action={saveDisplay}>
                <input type="hidden" name="csrf" value={csrf} />
                <label className="admin-field">
                  <span>Title</span>
                  <input className="admin-input" name="title" defaultValue={display.title} required maxLength={80} autoComplete="off" spellCheck={false} />
                </label>
                <label className="admin-field">
                  <span>Notes</span>
                  <textarea className="admin-textarea" name="notes" defaultValue={display.notes} maxLength={4000} autoComplete="off" />
                </label>
                <label className="admin-field">
                  <span>Public stream URL</span>
                  <input
                    className="admin-input"
                    name="streamUrl"
                    type="url"
                    inputMode="url"
                    defaultValue={display.streamUrl}
                    placeholder="https://stream.example/p2s/index.m3u8…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="admin-check">
                  <input type="checkbox" name="amsOwnSupply" defaultChecked={display.amsOwnSupply} />
                  <span>AMS on its own power supply</span>
                </label>
                <p className="admin-muted">Off: drying replaces the print card. On: a print and a dry can show together.</p>
                <label className="admin-field">
                  <span>MediaMTX API URL</span>
                  <input
                    className="admin-input"
                    name="mediamtxApiUrl"
                    type="url"
                    inputMode="url"
                    defaultValue={display.mediamtxApiUrl}
                    placeholder="http://192.168.1.8:9997"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="admin-field">
                  <span>MediaMTX path</span>
                  <input className="admin-input" name="mediamtxPath" defaultValue={display.mediamtxPath} autoComplete="off" spellCheck={false} />
                </label>
                <label className="admin-field">
                  <span>MediaMTX API user</span>
                  <input className="admin-input" name="mediamtxApiUser" defaultValue={display.mediamtxApiUser} autoComplete="off" spellCheck={false} />
                </label>
                <label className="admin-field">
                  <span>MediaMTX API password</span>
                  <input className="admin-input" name="mediamtxApiPassword" type="password" autoComplete="new-password" placeholder="Leave blank to keep the saved password" />
                </label>
                <label className="admin-check">
                  <input type="checkbox" name="alwaysShowCamera" defaultChecked={display.alwaysShowCamera} />
                  <span>Always show camera</span>
                </label>
                <div className="admin-notice warn" role="note">
                  <strong>Not a private camera</strong>
                  <p>Always show only changes the dashboard until a MediaMTX API URL is set. With that URL, an idle printer removes the camera path, so the public playlist stops. The address is still known, and the stream comes back when a print starts or always-show is on. Do not expose the API port to the internet.</p>
                </div>
                <button className="admin-btn primary" type="submit">Save</button>
              </form>
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel-head">
              <h2>Audit</h2>
              <p>Recent admin events.</p>
            </div>
            <div className="admin-panel-body">
              {audit().length === 0 ? (
                <p className="admin-muted">No admin events yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table admin-table">
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
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
