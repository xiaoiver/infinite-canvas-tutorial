/**
 * `@infinite-canvas-tutorial/figma`
 *
 * Import from / export to Figma for the Infinite Canvas `.ic` format.
 *
 * - **Import (Figma → .ic):** {@link parseFigFileToSerializedNodes} reads a
 *   local `.fig` ZIP (via openfig-core + {@link figDocumentToFigmaFileResponse}),
 *   or {@link FigmaRestClient} fetches a cloud file from the read-only REST API;
 *   both paths use {@link parseFigmaFileToSerializedNodes} for the final `.ic`
 *   document consumed by `API.importIcDocument`.
 * - **Export (.ic → Figma):** {@link serializedNodesToFigmaScene} produces a
 *   JSON payload that the companion Figma plugin (`figma-plugin/`) replays.
 *
 * @see https://www.figma.com/developers/api
 */

export * from './constants';
export * from './figma-types';
export * from './rest-client';
export * from './fig-to-figma';
export * from './figma-to-ic';
export * from './ic-to-figma';
export * from './parse-fig-file';
