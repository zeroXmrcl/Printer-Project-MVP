import { SiteHeader } from "../components/chrome";
import { LiveBoard } from "../components/live-board";
import { dashboard, settings } from "../lib/store";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const display = settings();
  return (
    <main className="shell">
      <SiteHeader title={display.title} notes={display.notes} current="live" />
      <LiveBoard initial={dashboard()} />
    </main>
  );
}
