/**
 * Figma auto-layout (REST + `.fig` stack* fields) → `.ic` {@link FlexboxLayoutAttributes}.
 */

import type { FigNode } from 'openfig-core';

import type { FigmaNode } from './figma-types';

type FigmaAxisAlign =
  | 'MIN'
  | 'CENTER'
  | 'MAX'
  | 'SPACE_BETWEEN'
  | 'SPACE_EVENLY'
  | 'BASELINE'
  | 'STRETCH'
  | string;

type FigmaSizingMode = 'FIXED' | 'AUTO' | string;

type FigmaStackSize = 'FIXED' | 'RESIZE_TO_FIT' | 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE' | string;

function mapPrimaryAxisAlign(
  value: FigmaAxisAlign | undefined,
): 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-evenly' | undefined {
  switch (value) {
    case 'MIN':
      return 'flex-start';
    case 'CENTER':
      return 'center';
    case 'MAX':
      return 'flex-end';
    case 'SPACE_BETWEEN':
      return 'space-between';
    case 'SPACE_EVENLY':
      return 'space-evenly';
    default:
      return undefined;
  }
}

function mapCounterAxisAlign(
  value: FigmaAxisAlign | undefined,
): 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline' | undefined {
  switch (value) {
    case 'MIN':
      return 'flex-start';
    case 'CENTER':
      return 'center';
    case 'MAX':
      return 'flex-end';
    case 'STRETCH':
      return 'stretch';
    case 'BASELINE':
      return 'baseline';
    default:
      return undefined;
  }
}

function mapAlignSelf(
  value: FigmaAxisAlign | undefined,
): 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline' | undefined {
  switch (value) {
    case 'AUTO':
    case 'INHERIT':
      return 'auto';
    case 'MIN':
      return 'flex-start';
    case 'CENTER':
      return 'center';
    case 'MAX':
      return 'flex-end';
    case 'STRETCH':
      return 'stretch';
    case 'BASELINE':
      return 'baseline';
    default:
      return undefined;
  }
}

function stackSizeToSizingMode(size: FigmaStackSize | undefined): FigmaSizingMode | undefined {
  if (!size || size === 'FIXED') {
    return 'FIXED';
  }
  if (size === 'RESIZE_TO_FIT' || size === 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE') {
    return 'AUTO';
  }
  return undefined;
}

function resolvePadding(node: FigmaNode): [number, number, number, number] | undefined {
  const top = node.paddingTop as number | undefined;
  const right = node.paddingRight as number | undefined;
  const bottom = node.paddingBottom as number | undefined;
  const left = node.paddingLeft as number | undefined;
  if (
    top == null &&
    right == null &&
    bottom == null &&
    left == null
  ) {
    return undefined;
  }
  const t = top ?? 0;
  const r = right ?? left ?? 0;
  const l = left ?? r;
  const b = bottom ?? t;
  return [t, r, b, l];
}

function resolveFigPadding(node: FigNode): [number, number, number, number] | undefined {
  const h = node.stackHorizontalPadding;
  const v = node.stackVerticalPadding;
  const left = node.stackPadding ?? h;
  const right = node.stackPaddingRight ?? h ?? left;
  const top = v;
  const bottom = node.stackPaddingBottom ?? v;
  if (
    left == null &&
    right == null &&
    top == null &&
    bottom == null
  ) {
    return undefined;
  }
  const l = left ?? 0;
  const r = right ?? l;
  const t = top ?? 0;
  const b = bottom ?? t;
  return [t, r, b, l];
}

function applyHugFlags(
  target: Record<string, unknown>,
  layoutMode: 'HORIZONTAL' | 'VERTICAL',
  primarySizing: FigmaSizingMode | undefined,
  counterSizing: FigmaSizingMode | undefined,
): void {
  const primaryHug = primarySizing === 'AUTO';
  const counterHug = counterSizing === 'AUTO';
  if (layoutMode === 'HORIZONTAL') {
    if (primaryHug) {
      target.flexHugWidth = true;
    } else if (primarySizing === 'FIXED') {
      target.flexHugWidth = false;
    }
    if (counterHug) {
      target.flexHugHeight = true;
    } else if (counterSizing === 'FIXED') {
      target.flexHugHeight = false;
    }
  } else {
    if (primaryHug) {
      target.flexHugHeight = true;
    } else if (primarySizing === 'FIXED') {
      target.flexHugHeight = false;
    }
    if (counterHug) {
      target.flexHugWidth = true;
    } else if (counterSizing === 'FIXED') {
      target.flexHugWidth = false;
    }
  }
}

function applyGap(
  target: Record<string, unknown>,
  layoutMode: 'HORIZONTAL' | 'VERTICAL',
  itemSpacing: number | undefined,
  counterAxisSpacing: number | undefined,
): void {
  if (typeof itemSpacing === 'number') {
    target.gap = itemSpacing;
  }
  if (typeof counterAxisSpacing !== 'number') {
    return;
  }
  if (layoutMode === 'HORIZONTAL') {
    target.rowGap = counterAxisSpacing;
    if (typeof itemSpacing === 'number') {
      target.columnGap = itemSpacing;
    }
  } else {
    target.rowGap = itemSpacing ?? counterAxisSpacing;
    target.columnGap = counterAxisSpacing;
  }
}

/**
 * Map openfig `.fig` stack* fields onto REST-shaped layout properties on {@link FigmaNode}.
 */
export function mapFigAutoLayoutToFigmaNode(node: FigNode, target: FigmaNode): void {
  const mode = node.stackMode;
  const isFlexContainer = mode === 'HORIZONTAL' || mode === 'VERTICAL';

  if (isFlexContainer) {
    target.layoutMode = mode;

    if (typeof node.stackSpacing === 'number') {
      target.itemSpacing = node.stackSpacing;
    }
    if (typeof node.stackCounterSpacing === 'number') {
      target.counterAxisSpacing = node.stackCounterSpacing;
    }

    const padding = resolveFigPadding(node);
    if (padding) {
      target.paddingTop = padding[0];
      target.paddingRight = padding[1];
      target.paddingBottom = padding[2];
      target.paddingLeft = padding[3];
    }

    const primaryAlign = node.stackPrimaryAlignItems ?? node.stackJustify;
    if (primaryAlign) {
      target.primaryAxisAlignItems = primaryAlign;
    }
    const counterAlign = node.stackCounterAlignItems ?? node.stackAlign;
    if (counterAlign) {
      target.counterAxisAlignItems = counterAlign;
    }

    const primarySizing = stackSizeToSizingMode(node.stackPrimarySizing);
    if (primarySizing) {
      target.primaryAxisSizingMode = primarySizing;
    }
    const counterSizing = stackSizeToSizingMode(node.stackCounterSizing);
    if (counterSizing) {
      target.counterAxisSizingMode = counterSizing;
    }

    if (node.stackWrap === 'WRAP') {
      target.layoutWrap = 'WRAP';
    } else if (node.stackWrap === 'NO_WRAP') {
      target.layoutWrap = 'NO_WRAP';
    }
  }

  if (typeof node.stackChildPrimaryGrow === 'number') {
    target.layoutGrow = node.stackChildPrimaryGrow;
  }
  if (node.stackChildAlignSelf) {
    target.layoutAlign = node.stackChildAlignSelf;
  }
  if (node.stackPositioning === 'ABSOLUTE') {
    target.layoutPositioning = 'ABSOLUTE';
  }
}

/**
 * Apply auto-layout container fields from a {@link FigmaNode} onto a serialized node record.
 */
export function applyAutoLayoutContainerAttributes(
  target: Record<string, unknown>,
  node: FigmaNode,
): void {
  const layoutMode = node.layoutMode as string | undefined;
  if (layoutMode !== 'HORIZONTAL' && layoutMode !== 'VERTICAL') {
    return;
  }

  target.display = 'flex';
  target.flexDirection = layoutMode === 'HORIZONTAL' ? 'row' : 'column';

  const justify = mapPrimaryAxisAlign(
    node.primaryAxisAlignItems as FigmaAxisAlign | undefined,
  );
  if (justify) {
    target.justifyContent = justify;
  }

  const align = mapCounterAxisAlign(
    node.counterAxisAlignItems as FigmaAxisAlign | undefined,
  );
  if (align) {
    target.alignItems = align;
  }

  const padding = resolvePadding(node);
  if (padding) {
    const allEqual =
      padding[0] === padding[1] &&
      padding[0] === padding[2] &&
      padding[0] === padding[3];
    target.padding = allEqual ? padding[0] : padding;
  }

  applyGap(
    target,
    layoutMode,
    node.itemSpacing as number | undefined,
    node.counterAxisSpacing as number | undefined,
  );

  const wrap = node.layoutWrap as string | undefined;
  if (wrap === 'WRAP') {
    target.flexWrap = 'wrap';
  } else if (wrap === 'NO_WRAP') {
    target.flexWrap = 'nowrap';
  }

  applyHugFlags(
    target,
    layoutMode,
    node.primaryAxisSizingMode as FigmaSizingMode | undefined,
    node.counterAxisSizingMode as FigmaSizingMode | undefined,
  );
}

/**
 * Apply auto-layout child fields (grow, align self, absolute positioning).
 */
export function applyAutoLayoutChildAttributes(
  target: Record<string, unknown>,
  node: FigmaNode,
): void {
  const grow = node.layoutGrow as number | undefined;
  if (typeof grow === 'number' && grow > 0) {
    target.flexGrow = grow;
  }

  const alignSelf = mapAlignSelf(
    (node.layoutAlign as FigmaAxisAlign | undefined) ??
      (node.stackChildAlignSelf as FigmaAxisAlign | undefined),
  );
  if (alignSelf && alignSelf !== 'auto') {
    target.alignSelf = alignSelf;
  }

  const positioning = node.layoutPositioning as string | undefined;
  if (positioning === 'ABSOLUTE') {
    target.position = 'absolute';
  }
}
