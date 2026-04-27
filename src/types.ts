export type DitherType = "DIFFUSION" | "ORDERED" | "NONE";

export type DitherKernel =
  | "FLOYD_STEINBERG"
  | "FALSE_FLOYD_STEINBERG"
  | "JARVIS_JUDICE_NINKE"
  | "STUCKI"
  | "ATKINSON"
  | "BURKES"
  | "SIERRA"
  | "TWO_ROW_SIERRA"
  | "SIERRA_LITE"
  | "BAYER";

export type Border = 0 | 1;

export interface PushImagePayload {
  /** Base64-encoded PNG (296x152). Do NOT include the `data:image/png;base64,` prefix. */
  image: string;
  /** Whether to display immediately. Default true. */
  refreshNow?: boolean;
  /** Optional http/https or scheme URL bound to the image. */
  link?: string;
  /** 0 = white border, 1 = black border. Default 0. */
  border?: Border;
  ditherType?: DitherType;
  ditherKernel?: DitherKernel;
  /** Target task key when multiple image-API contents are configured. */
  taskKey?: string;
}

export interface DotApiResponse<T = unknown> {
  code: number;
  message: string;
  result?: T;
}

export interface DotClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** Optional fetch impl (e.g. for tests). Defaults to global fetch. */
  fetch?: typeof fetch;
}
