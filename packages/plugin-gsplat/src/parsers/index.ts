import { GsplatData } from '../GsplatData';
import { parsePly } from './ply';
import { parseSplat } from './splat';

export * from './ply';
export * from './splat';

/** Supported gaussian-splat asset formats. */
export type GsplatFormat = 'ply' | 'splat';

/** Infer the splat format from a file name / URL extension. */
export function inferGsplatFormat(nameOrUrl: string): GsplatFormat | undefined {
  const lower = nameOrUrl.split(/[?#]/)[0].toLowerCase();
  if (lower.endsWith('.ply')) return 'ply';
  if (lower.endsWith('.splat')) return 'splat';
  return undefined;
}

/**
 * Parse a gaussian-splat asset from a raw buffer. The format is taken from
 * {@link format} when provided, otherwise inferred from {@link nameOrUrl}.
 */
export function parseGsplat(
  buffer: ArrayBuffer,
  options: { format?: GsplatFormat; nameOrUrl?: string } = {},
): GsplatData {
  const format =
    options.format ??
    (options.nameOrUrl ? inferGsplatFormat(options.nameOrUrl) : undefined);
  if (format === 'ply') return parsePly(buffer);
  if (format === 'splat') return parseSplat(buffer);
  throw new Error(
    'parseGsplat: could not determine format; pass { format } or a recognisable nameOrUrl',
  );
}
