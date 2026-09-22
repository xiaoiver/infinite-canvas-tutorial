/**
 * Local copies of the `.ic` document constants. These mirror
 * `@infinite-canvas-tutorial/ecs`'s `format/ic-document` values so the
 * converter has **no runtime dependency** on ecs (only `import type`),
 * which keeps it trivially unit-testable and tree-shakeable.
 *
 * Keep these in sync with `packages/ecs/src/format/ic-document.ts`.
 */
export const IC_DOCUMENT_TYPE = 'infinite-canvas' as const;
export const IC_SCHEMA_VERSION = 1 as const;
export const IC_FILE_SUFFIX = '.ic';
