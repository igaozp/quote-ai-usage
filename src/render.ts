import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";

export const CARD_WIDTH = 296;
export const CARD_HEIGHT = 152;

export interface UsageStat {
  label: string;
  value: string;
}

export interface UsageData {
  title: string;
  primary: string;
  secondary?: string;
  stats?: UsageStat[];
  updatedAt?: string;
}

export interface RenderFont {
  name: string;
  data: ArrayBuffer;
  weight?: 400 | 600 | 700;
  style?: "normal" | "italic";
}

export interface RenderOptions {
  fonts: RenderFont[];
}

let resvgReady = false;

type WasmInput = Parameters<typeof initWasm>[0];

export async function ensureResvgInit(wasm: WasmInput): Promise<void> {
  if (resvgReady) return;
  await initWasm(wasm);
  resvgReady = true;
}

export async function renderUsageCard(
  data: UsageData,
  options: RenderOptions,
): Promise<Uint8Array> {
  const svg = await satori(buildTree(data) as never, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: options.fonts.map((f) => ({
      name: f.name,
      data: f.data as ArrayBuffer,
      weight: f.weight ?? 400,
      style: f.style ?? "normal",
    })),
  });

  const png = new Resvg(svg, {
    background: "white",
    fitTo: { mode: "width", value: CARD_WIDTH },
  })
    .render()
    .asPng();

  return png;
}

interface Node {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: Node | string | Array<Node | string | null | undefined>;
  };
}

function div(
  style: Record<string, unknown>,
  children?: Node["props"]["children"],
): Node {
  return { type: "div", props: { style, children } };
}

function buildTree(data: UsageData): Node {
  const stats = data.stats ?? [];
  return div(
    {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      padding: "10px 14px",
      backgroundColor: "white",
      color: "black",
      fontFamily: "UI",
    },
    [
      div(
        {
          display: "flex",
          fontSize: 10,
          fontWeight: 400,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        },
        data.title,
      ),
      div(
        {
          display: "flex",
          fontSize: 38,
          fontWeight: 700,
          lineHeight: 1.05,
          marginTop: 2,
        },
        data.primary,
      ),
      data.secondary
        ? div(
            { display: "flex", fontSize: 11, marginTop: 1 },
            data.secondary,
          )
        : null,
      div({ display: "flex", flex: 1 }),
      stats.length > 0
        ? div(
            {
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
            },
            [
              ...stats.map((s) =>
                div(
                  { display: "flex", flexDirection: "column" },
                  [
                    div(
                      {
                        display: "flex",
                        fontSize: 8,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                      },
                      s.label,
                    ),
                    div(
                      { display: "flex", fontSize: 14, fontWeight: 700 },
                      s.value,
                    ),
                  ],
                ),
              ),
              data.updatedAt
                ? div(
                    {
                      display: "flex",
                      fontSize: 9,
                      alignSelf: "flex-end",
                    },
                    data.updatedAt,
                  )
                : null,
            ],
          )
        : null,
    ],
  );
}
