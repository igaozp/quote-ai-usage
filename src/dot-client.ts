import type {
  DotApiResponse,
  DotClientConfig,
  PushImagePayload,
} from "./types.js";

const DEFAULT_BASE_URL = "https://dot.mindreset.tech";

export class DotApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | undefined,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "DotApiError";
  }
}

export class DotClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: DotClientConfig) {
    if (!config.apiKey) {
      throw new Error("DotClient: apiKey is required");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = config.fetch ?? fetch;
  }

  /**
   * Push a 296x152 PNG (base64) to a device.
   * Endpoint: POST /api/authV2/open/device/:deviceId/image
   */
  async pushImage(
    deviceId: string,
    payload: PushImagePayload,
  ): Promise<DotApiResponse> {
    if (!deviceId) {
      throw new Error("DotClient.pushImage: deviceId is required");
    }
    if (!payload.image) {
      throw new Error("DotClient.pushImage: payload.image is required");
    }

    const url = `${this.baseUrl}/api/authV2/open/device/${encodeURIComponent(deviceId)}/image`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer dot_app_${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      // keep raw text
    }

    if (!res.ok) {
      const code = isApiResponse(body) ? body.code : undefined;
      const message = isApiResponse(body) ? body.message : res.statusText;
      throw new DotApiError(
        `Dot API request failed (${res.status}): ${message}`,
        res.status,
        code,
        body,
      );
    }

    if (!isApiResponse(body)) {
      throw new DotApiError(
        "Dot API returned an unexpected body shape",
        res.status,
        undefined,
        body,
      );
    }

    if (body.code !== 200) {
      throw new DotApiError(
        `Dot API error (code ${body.code}): ${body.message}`,
        res.status,
        body.code,
        body,
      );
    }

    return body;
  }
}

function isApiResponse(value: unknown): value is DotApiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value
  );
}

/**
 * Encode raw PNG bytes to a base64 string. Uses only Web-standard `btoa`,
 * which is available in Node 18+, Cloudflare Workers, and browsers.
 */
export function pngBytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(binary);
}
