import { writeFile } from "node:fs/promises";
import { argv, env, exit } from "node:process";
import { DotClient, pngBytesToBase64 } from "./dot-client.js";
import { loadConfig } from "./config.js";
import { renderUsageCardLocal } from "./render.node.js";
import type { UsageData } from "./render.js";

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

async function main() {
  const dryRun = argv.includes("--dry-run");
  const previewPath = env.DEBUG_PNG;

  const png = await renderUsageCardLocal(demoData());

  if (previewPath) {
    await writeFile(previewPath, png);
    console.log(`Preview saved to ${previewPath} (${png.byteLength} bytes)`);
  }

  if (dryRun) {
    console.log("Dry run — skipping device push.");
    return;
  }

  const config = loadConfig(env);
  const client = new DotClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });

  const res = await client.pushImage(config.deviceId, {
    image: pngBytesToBase64(png),
    refreshNow: true,
    border: 0,
    ditherType: "DIFFUSION",
    ditherKernel: "FLOYD_STEINBERG",
  });
  console.log("Pushed:", res);
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
