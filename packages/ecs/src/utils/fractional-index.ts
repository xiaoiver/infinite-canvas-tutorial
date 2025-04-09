/**
 * @see https://github.com/excalidraw/excalidraw/blob/f2e8404c7bee230c12e78747492fd120a7929a67/packages/element/src/fractionalIndex.ts#L2
 */

import { generateNKeysBetween } from 'fractional-indexing';
import {
  FractionalIndex,
  OrderedSerializedNode,
  SerializedNode,
} from './serialize';

const isOrderedElement = (
  element: SerializedNode,
): element is OrderedSerializedNode => {
  // for now it's sufficient whether the index is there
  // meaning, the element was already ordered in the past
  // meaning, it is not a newly inserted element, not an unrestored element, etc.
  // it does not have to mean that the index itself is valid
  if (element.index) {
    return true;
  }

  return false;
};

/**
 * Order the elements based on the fractional indices.
 * - when fractional indices are identical, break the tie based on the element id
 * - when there is no fractional index in one of the elements, respect the order of the array
 */
export const orderByFractionalIndex = (elements: OrderedSerializedNode[]) => {
  return elements.sort((a, b) => {
    // in case the indices are not the defined at runtime
    if (isOrderedElement(a) && isOrderedElement(b)) {
      if (a.index < b.index) {
        return -1;
      } else if (a.index > b.index) {
        return 1;
      }

      // break ties based on the element id
      return a.id < b.id ? -1 : 1;
    }

    // defensively keep the array order
    return 1;
  });
};

export function generateIndices(
  elements: readonly SerializedNode[],
  indicesGroups: number[][],
) {
  const elementsUpdates = new Map<SerializedNode, { index: FractionalIndex }>();

  for (const indices of indicesGroups) {
    const lowerBoundIndex = indices.shift()!;
    const upperBoundIndex = indices.pop()!;

    const fractionalIndices = generateNKeysBetween(
      elements[lowerBoundIndex]?.index,
      elements[upperBoundIndex]?.index,
      indices.length,
    ) as FractionalIndex[];

    for (let i = 0; i < indices.length; i++) {
      const element = elements[indices[i]];

      elementsUpdates.set(element, {
        index: fractionalIndices[i],
      });
    }
  }

  return elementsUpdates;
}
