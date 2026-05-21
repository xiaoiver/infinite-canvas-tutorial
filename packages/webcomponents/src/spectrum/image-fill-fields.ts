import type { SerializedFillLayerItem } from '@infinite-canvas-tutorial/ecs';

export type ImageObjectFit =
  | 'fill'
  | 'contain'
  | 'cover'
  | 'none'
  | 'scale-down';

export const IMAGE_OBJECT_FIT_VALUES: readonly ImageObjectFit[] = [
  'fill',
  'contain',
  'cover',
  'none',
  'scale-down',
] as const;

export type ImageFillChangeFields = {
  objectFit?: ImageObjectFit;
  objectPosition?: string;
};

/** Apply `object-fit` / `object-position` on an image fill layer from picker events. */
export function applyImageFillChangeFields(
  layer: SerializedFillLayerItem,
  fields: ImageFillChangeFields,
): SerializedFillLayerItem {
  if (layer.type !== 'image') {
    return layer;
  }
  const next = { ...layer };
  if (fields.objectFit !== undefined) {
    next.objectFit = fields.objectFit;
  }
  if (fields.objectPosition !== undefined) {
    const pos = fields.objectPosition.trim();
    if (pos) {
      next.objectPosition = pos;
    } else {
      delete (next as { objectPosition?: string }).objectPosition;
    }
  }
  return next;
}

export function imageFillFieldsFromDetail(detail: {
  objectFit?: ImageObjectFit;
  objectPosition?: string;
}): ImageFillChangeFields {
  const fields: ImageFillChangeFields = {};
  if (detail.objectFit !== undefined) {
    fields.objectFit = detail.objectFit;
  }
  if (detail.objectPosition !== undefined) {
    fields.objectPosition = detail.objectPosition;
  }
  return fields;
}
