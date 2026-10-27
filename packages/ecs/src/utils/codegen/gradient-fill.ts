import type { SerializedFillLayerItem } from '../../types/serialized-node';
import { parseGradient } from '../gradient';

/** Only standard CSS gradients can be transferred directly to a DOM background. */
export function isCssGradient(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:linear|radial)-gradient\(/i.test(value.trim())
  );
}

/** Convert the canvas's legacy conic circle syntax to a valid CSS background. */
export function cssBackgroundGradient(value: unknown): string | undefined {
  if (isCssGradient(value)) return value;
  if (typeof value !== 'string' || !/^conic-gradient\(/i.test(value.trim()))
    return undefined;
  try {
    const gradients = parseGradient(value);
    if (gradients?.length !== 1 || gradients[0].type !== 'conic-gradient')
      return undefined;
  } catch {
    return undefined;
  }
  const css = value.replace(
    /^(\s*conic-gradient\(\s*)circle(?:\s+at\s+([^,()]+))?\s*,/i,
    (_match, prefix: string, position: string | undefined) =>
      `${prefix}${position ? `at ${position.trim()},` : ''}`,
  );
  return /^\s*conic-gradient\(\s*circle\b/i.test(css) ? undefined : css;
}

export function singleCssGradientFill(
  fills: SerializedFillLayerItem[],
): string | undefined {
  const active = fills.filter((fill) => fill.enabled !== false);
  if (active.length !== 1) return undefined;
  const fill = active[0];
  const gradient =
    fill.type === 'gradient' ? cssBackgroundGradient(fill.value) : undefined;
  if (
    !gradient ||
    (fill.opacity !== undefined && Number(fill.opacity) !== 1) ||
    (fill.blendMode !== undefined && fill.blendMode !== 'normal')
  )
    return undefined;
  return gradient;
}
