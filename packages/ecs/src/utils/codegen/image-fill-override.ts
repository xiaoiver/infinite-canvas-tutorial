import { documentValueEqual } from '../../document';

/** Image components can bind a URL, but changing the fill type or paint options needs expansion. */
export function hasUnsupportedImageFillOverride(
  templateFills: unknown,
  renderedFills: unknown,
): boolean {
  if (documentValueEqual(templateFills, renderedFills)) return false;
  const template = Array.isArray(templateFills) ? templateFills : [];
  const rendered = Array.isArray(renderedFills) ? renderedFills : [];
  if (
    !template.some((fill) => fill.type === 'image') &&
    !rendered.some((fill) => fill.type === 'image')
  )
    return false;
  if (
    template.length !== 1 ||
    rendered.length !== 1 ||
    template[0].type !== 'image' ||
    rendered[0].type !== 'image'
  )
    return true;
  const templateOptions = { ...template[0] };
  const renderedOptions = { ...rendered[0] };
  delete templateOptions.value;
  delete renderedOptions.value;
  return !documentValueEqual(templateOptions, renderedOptions);
}
