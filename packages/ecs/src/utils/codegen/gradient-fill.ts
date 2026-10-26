import type { SerializedFillLayerItem } from '../../types/serialized-node';

/** Only standard CSS gradients can be transferred directly to a DOM background. */
export function isCssGradient(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:linear|radial)-gradient\(/i.test(value.trim())
  );
}

export function singleCssGradientFill(
  fills: SerializedFillLayerItem[],
): string | undefined {
  const active = fills.filter((fill) => fill.enabled !== false);
  if (active.length !== 1) return undefined;
  const fill = active[0];
  if (
    fill.type !== 'gradient' ||
    !isCssGradient(fill.value) ||
    (fill.opacity !== undefined && Number(fill.opacity) !== 1) ||
    (fill.blendMode !== undefined && fill.blendMode !== 'normal')
  )
    return undefined;
  return fill.value;
}
