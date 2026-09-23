import { dashboard } from "../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const payload = JSON.stringify(dashboard());
        controller.enqueue(encoder.encode(`event: live\ndata: ${payload}\n\n`));
      };
      send();
      timer = setInterval(send, 1000);
      request.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
