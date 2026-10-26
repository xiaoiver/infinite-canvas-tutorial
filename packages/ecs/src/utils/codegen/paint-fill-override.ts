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
  if (
    !template.some(
      (fill) => fill.type === 'image' || fill.type === 'gradient',
    ) &&
    !rendered.some((fill) => fill.type === 'image' || fill.type === 'gradient')
  )
    return false;
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
