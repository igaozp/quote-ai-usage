import resvgWasm from "./vendor/resvg.wasm";
import regularFont from "../assets/fonts/Regular.ttf";
import boldFont from "../assets/fonts/Bold.ttf";
import {
  ensureResvgInit,
  renderUsageCard,
  type UsageData,
} from "./render.js";

export async function renderUsageCardWorker(
  data: UsageData,
): Promise<Uint8Array> {
  await ensureResvgInit(resvgWasm);
  return renderUsageCard(data, {
    fonts: [
      { name: "UI", data: regularFont, weight: 400 },
      { name: "UI", data: boldFont, weight: 700 },
    ],
  });
}
