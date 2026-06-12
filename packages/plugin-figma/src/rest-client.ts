/**
 * Thin wrapper around the read-only [Figma REST API](https://www.figma.com/developers/api).
 *
 * Network access is injected (defaults to the global `fetch`) so the client can
 * be unit-tested without real requests. Authentication uses a
 * [personal access token](https://www.figma.com/developers/api#access-tokens)
 * sent via the `X-Figma-Token` header.
 *
 * Export back into Figma is intentionally absent: the REST API cannot write
 * document content. Use the companion Figma plugin (see `figma-plugin/`) for
 * the `.ic` → Figma direction.
 */

import type {
  FigmaFileResponse,
  FigmaImageFillsResponse,
  FigmaImagesResponse,
} from './figma-types';

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

export interface FigmaRestClientOptions {
  /** Figma personal access token (`X-Figma-Token`). */
  token: string;
  /** Override the API base URL (e.g. for a proxy). */
  baseUrl?: string;
  /** Custom fetch implementation; defaults to the global `fetch`. */
  fetch?: FetchLike;
}

const DEFAULT_BASE_URL = 'https://api.figma.com';

/**
 * Extract the Figma file key from either a bare key or a full file URL such as
 * `https://www.figma.com/file/<key>/<name>` or `/design/<key>/<name>`.
 */
export function parseFigmaFileKey(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/figma\.com\/(?:file|design)\/([^/?#]+)/i);
  if (match) {
    return match[1];
  }
  return trimmed;
}

export class FigmaRestClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: FigmaRestClientOptions) {
    if (!options.token) {
      throw new Error('A Figma personal access token is required');
    }
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    const injected = options.fetch;
    if (injected) {
      this.fetchImpl = injected;
    } else if (typeof fetch !== 'undefined') {
      this.fetchImpl = fetch as unknown as FetchLike;
    } else {
      throw new Error('No fetch implementation available');
    }
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { 'X-Figma-Token': this.token },
    });
    if (!res.ok) {
      throw new Error(
        `Figma API request failed: ${res.status} ${res.statusText} (${path})`,
      );
    }
    return (await res.json()) as T;
  }

  /** `GET /v1/files/:key` — the full document tree. */
  getFile(fileKey: string): Promise<FigmaFileResponse> {
    return this.get<FigmaFileResponse>(
      `/v1/files/${encodeURIComponent(parseFigmaFileKey(fileKey))}`,
    );
  }

  /**
   * `GET /v1/files/:key/images` — maps image-fill `imageRef`s to downloadable
   * URLs. Use the result as {@link FigmaToIcOptions.imageRefUrls}.
   */
  async getImageFills(fileKey: string): Promise<Record<string, string>> {
    const res = await this.get<FigmaImageFillsResponse>(
      `/v1/files/${encodeURIComponent(parseFigmaFileKey(fileKey))}/images`,
    );
    return res.meta?.images ?? {};
  }

  /**
   * `GET /v1/images/:key?ids=…&format=…` — render the given node ids to images
   * (e.g. to rasterize vectors). Returns node id → URL.
   */
  async getRenderedImages(
    fileKey: string,
    ids: string[],
    format: 'png' | 'svg' | 'jpg' | 'pdf' = 'svg',
    scale = 1,
  ): Promise<Record<string, string | null>> {
    if (ids.length === 0) {
      return {};
    }
    const params = new URLSearchParams({
      ids: ids.join(','),
      format,
      scale: String(scale),
    });
    const res = await this.get<FigmaImagesResponse>(
      `/v1/images/${encodeURIComponent(
        parseFigmaFileKey(fileKey),
      )}?${params.toString()}`,
    );
    if (res.err) {
      throw new Error(`Figma image render failed: ${res.err}`);
    }
    return res.images ?? {};
  }
}
