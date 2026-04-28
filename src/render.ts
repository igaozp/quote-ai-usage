import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";

export const CARD_WIDTH = 296;
export const CARD_HEIGHT = 152;

export interface CardRow {
  /** Left label (e.g. "CLAUDE", "CODEX") */
  label: string;
  /** Right-aligned headline value (e.g. "$12.34", "2% USED") */
  primary: string;
  /** Bottom-row text shown when there's no progress bar (e.g. "13.0M tok") */
  secondary?: string;
  /** 0-100 → render a progress bar instead of `secondary`. */
  progressPct?: number;
  /** Right-aligned small text on the bottom row (e.g. "RESETS 3H 53M") */
  meta?: string;
}

export interface UsageData {
  title: string;
  rows: CardRow[];
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
    children?: Node | string | Array<Node | string>;
  };
}

function div(
  style: Record<string, unknown>,
  children?: Node["props"]["children"],
): Node {
  return { type: "div", props: { style, children } };
}

function compact<T>(arr: Array<T | null | undefined | false>): T[] {
  return arr.filter((x): x is T => Boolean(x));
}

// ---------- layout constants (296x152) ----------
const PADDING_X = 10;
const TITLE_HEIGHT = 22;
const CARD_GAP = 4;
const CARD_HEIGHT_INNER = (CARD_HEIGHT - TITLE_HEIGHT - PADDING_X * 0 - CARD_GAP * 1 - 8) / 2; // 2 rows
const BAR_WIDTH = 150;
const BAR_HEIGHT = 10;
const BAR_BORDER = 2;

function buildTree(data: UsageData): Node {
  return div(
    {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      backgroundColor: "white",
      color: "black",
      fontFamily: "UI",
    },
    [
      // Title
      div(
        {
          display: "flex",
          padding: `6px ${PADDING_X}px 2px`,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 2,
        },
        data.title,
      ),
      // Cards container
      div(
        {
          display: "flex",
          flexDirection: "column",
          padding: `0 ${PADDING_X}px ${PADDING_X}px`,
          gap: CARD_GAP,
          flex: 1,
        },
        data.rows.map(renderCard),
      ),
    ],
  );
}

function renderCard(row: CardRow): Node {
  return div(
    {
      display: "flex",
      flexDirection: "column",
      flex: 1,
      border: "1px solid black",
      padding: "5px 8px",
      justifyContent: "space-between",
    },
    [
      // Top row: label (left) + primary (right)
      div(
        {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        [
          div(
            {
              display: "flex",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
            },
            row.label,
          ),
          div(
            {
              display: "flex",
              fontSize: 17,
              fontWeight: 700,
              lineHeight: 1,
            },
            row.primary,
          ),
        ],
      ),
      // Bottom row: progress bar OR secondary text, plus meta
      div(
        {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        compact([
          row.progressPct != null
            ? renderProgressBar(row.progressPct)
            : row.secondary
              ? div(
                  {
                    display: "flex",
                    fontSize: 10,
                    fontWeight: 700,
                  },
                  row.secondary,
                )
              : div({ display: "flex" }, ""),
          row.meta
            ? div(
                {
                  display: "flex",
                  fontSize: 9,
                  fontWeight: 400,
                  letterSpacing: 1,
                },
                row.meta,
              )
            : null,
        ]),
      ),
    ],
  );
}

function renderProgressBar(pct: number): Node {
  const clamped = Math.max(0, Math.min(100, pct));
  const innerWidth = BAR_WIDTH - BAR_BORDER * 2 - 2; // account for inner padding
  const filled = Math.max(0, Math.round((clamped / 100) * innerWidth));
  return div(
    {
      display: "flex",
      width: BAR_WIDTH,
      height: BAR_HEIGHT,
      border: `${BAR_BORDER}px solid black`,
      padding: 1,
      alignItems: "stretch",
    },
    [
      div(
        {
          display: "flex",
          width: filled,
          height: "100%",
          backgroundColor: "black",
        },
        "",
      ),
    ],
  );
}
