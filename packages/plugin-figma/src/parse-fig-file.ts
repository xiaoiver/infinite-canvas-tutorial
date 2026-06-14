/**
 * Parse a local Figma `.fig` file into an Infinite Canvas `.ic` document.
 */

import { parseFig } from 'openfig-core';
import type { ICDocumentV1 } from '@infinite-canvas-tutorial/ecs';

import {
  buildImageRefUrlsFromFigDocument,
  figDocumentToFigmaFileResponse,
} from './fig-to-figma';
import { parseFigmaFileToSerializedNodes } from './figma-to-ic';

export interface ParseFigFileOptions {
  /** Document `source` written into the produced `.ic` document. */
  source?: string;
}

/**
 * Read a `.fig` ZIP archive and convert it into an `.ic` document for
 * `API.importIcDocument`.
 */
export function parseFigFileToSerializedNodes(
  data: Uint8Array | ArrayBuffer,
  options: ParseFigFileOptions = {},
): ICDocumentV1 {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const figDoc = parseFig(bytes);
  const file = figDocumentToFigmaFileResponse(figDoc);
  const imageRefUrls = buildImageRefUrlsFromFigDocument(figDoc);
  return parseFigmaFileToSerializedNodes(file, {
    imageRefUrls,
    source: options.source ?? 'https://www.figma.com',
  });
}
