import { SiteHeader } from "../components/chrome";
import { LiveBoard } from "../components/live-board";
import { dashboard } from "../lib/store";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="shell">
      <SiteHeader current="live" />
      <LiveBoard initial={dashboard()} />
    </main>
  );
}
