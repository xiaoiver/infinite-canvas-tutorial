import { randomInteger } from '../utils';
import { SerializedNode } from '../utils/serialize';

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type ElementUpdate<TElement extends SerializedNode> = Omit<
  Partial<TElement>,
  'uid' | 'version' | 'versionNonce' | 'updated'
>;

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing. Note: this will trigger the component to update. Make sure you
// are calling it either from a React event handler or within unstable_batchedUpdates().
export const mutateElement = <TElement extends Mutable<SerializedNode>>(
  element: TElement,
  updates: ElementUpdate<TElement>,
  informMutation = true,
  options?: {
    // Currently only for elbow arrows.
    // If true, the elbow arrow tries to bind to the nearest element. If false
    // it tries to keep the same bound element, if any.
    isDragging?: boolean;
  },
): TElement => {
  let didChange = false;

  if (!didChange) {
    return element;
  }

  element.version++;
  element.versionNonce = randomInteger();
  element.updated = Date.now();

  return element;
};
