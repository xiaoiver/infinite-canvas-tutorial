/**
 * `@infinite-canvas-tutorial/figma`
 *
 * Import from / export to Figma for the Infinite Canvas `.ic` format.
 *
 * - **Import (Figma → .ic):** {@link FigmaRestClient} fetches a file via the
 *   read-only Figma REST API, then {@link parseFigmaFileToSerializedNodes}
 *   converts it into an `.ic` document for `API.importIcDocument`.
 * - **Export (.ic → Figma):** {@link serializedNodesToFigmaScene} produces a
 *   JSON payload that the companion Figma plugin (`figma-plugin/`) replays.
 *
 * @see https://www.figma.com/developers/api
 */

export * from './constants';
export * from './figma-types';
export * from './rest-client';
export * from './figma-to-ic';
export * from './ic-to-figma';
