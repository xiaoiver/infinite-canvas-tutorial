import { documentValueEqual } from '../../document';
import { singleCssGradientFill } from './gradient-fill';

/** Single image URLs and CSS gradients can bind a value; paint options need expansion. */
export function hasUnsupportedPaintFillOverride(
  templateFills: unknown,
  renderedFills: unknown,
  gradientSupported = true,
): boolean {
  if (documentValueEqual(templateFills, renderedFills)) return false;
  const template = Array.isArray(templateFills) ? templateFills : [];
  const rendered = Array.isArray(renderedFills) ? renderedFills : [];
  if ([...template, ...rendered].some((fill) => fill.type === 'pattern'))
    return true;
  const translucentSolid = (fills: typeof template) =>
    fills.length === 1 &&
    fills[0].type === 'solid' &&
    fills[0].opacity !== undefined &&
    Number(fills[0].opacity) !== 1;
  if (
    !template.some(
      (fill) => fill.type === 'image' || fill.type === 'gradient',
    ) &&
    !rendered.some((fill) => fill.type === 'image' || fill.type === 'gradient')
  )
    return (
      translucentSolid(template) ||
      translucentSolid(rendered) ||
      template.filter((fill) => fill.enabled !== false).length > 1 ||
      rendered.filter((fill) => fill.enabled !== false).length > 1
    );
  if (
    template.length !== 1 ||
    rendered.length !== 1 ||
    template[0].type !== rendered[0].type ||
    (template[0].type !== 'image' && template[0].type !== 'gradient')
  )
    return true;
  if (
    template[0].type === 'gradient' &&
    (!gradientSupported ||
      !singleCssGradientFill(template) ||
      !singleCssGradientFill(rendered))
  )
    return true;
  const templateOptions = { ...template[0] };
  const renderedOptions = { ...rendered[0] };
  delete templateOptions.value;
  delete renderedOptions.value;
  return !documentValueEqual(templateOptions, renderedOptions);
}
