import { DotClient, pngBytesToBase64 } from "./dot-client.js";
import { loadConfig, type EnvLike } from "./config.js";
import { renderUsageCardWorker } from "./render.worker.js";
import type { UsageData } from "./render.js";

export interface Env extends EnvLike {
  DOT_API_KEY: string;
  DOT_DEVICE_ID: string;
  DOT_API_BASE_URL?: string;
}

function demoData(): UsageData {
  return {
    title: "AI Usage · Today",
    primary: "$12.34",
    secondary: "Anthropic + OpenAI · 24h",
    stats: [
      { label: "In", value: "1.2M" },
      { label: "Out", value: "345K" },
      { label: "Calls", value: "128" },
    ],
    updatedAt: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

async function pushOnce(env: Env) {
  const config = loadConfig(env);
  const png = await renderUsageCardWorker(demoData());
  const client = new DotClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });
  return client.pushImage(config.deviceId, {
    image: pngBytesToBase64(png),
    refreshNow: true,
    border: 0,
    ditherType: "DIFFUSION",
    ditherKernel: "FLOYD_STEINBERG",
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/push" && request.method === "POST") {
      try {
        const result = await pushOnce(env);
        return Response.json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json({ error: message }, { status: 500 });
      }
    }

    if (url.pathname === "/preview") {
      const png = await renderUsageCardWorker(demoData());
      return new Response(png, {
        headers: { "Content-Type": "image/png" },
      });
    }

    return new Response(
      "quote-ai-usage worker\n" +
        "  POST /push    — render & push to device\n" +
        "  GET  /preview — render PNG only\n",
      { headers: { "Content-Type": "text/plain" } },
    );
  },

  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      pushOnce(env).then(
        (r) => console.log("scheduled push ok:", r),
        (err) => console.error("scheduled push failed:", err),
      ),
    );
  },
};
