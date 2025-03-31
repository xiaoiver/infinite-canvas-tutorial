/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/change.ts#L399
 */

import {
  SerializedNode,
  OrderedSerializedNode,
  randomInteger,
  Name,
  Visibility,
  FillSolid,
  Stroke,
  Entity,
  Text,
} from '@infinite-canvas-tutorial/ecs';
import { isNil } from '@antv/util';
import { Change } from './Change';
import { Delta } from './Delta';
import { newElementWith } from './Snapshot';
import { getUpdatedTimestamp } from '../utils';

export type SceneElementsMap = Map<SerializedNode['id'], SerializedNode>;

export type ElementPartial = Partial<SerializedNode>;

export type ElementUpdate<TElement extends SerializedNode> = Omit<
  Partial<TElement>,
  'id' | 'version' | 'versionNonce' | 'updated'
>;

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export class ElementsChange implements Change<SceneElementsMap> {
  static empty() {
    return ElementsChange.create(new Map(), new Map(), new Map());
  }

  private static stripIrrelevantProps(
    partial: Partial<SerializedNode>,
  ): ElementPartial {
    const { id, version, versionNonce, ...strippedPartial } = partial;

    return strippedPartial;
  }

  /**
   * Calculates the `Delta`s between the previous and next set of elements.
   *
   * @param prevElements - Map representing the previous state of elements.
   * @param nextElements - Map representing the next state of elements.
   *
   * @returns `ElementsChange` instance representing the `Delta` changes between the two sets of elements.
   */
  public static calculate<T extends SerializedNode>(
    prevElements: Map<string, T>,
    nextElements: Map<string, T>,
  ): ElementsChange {
    if (prevElements === nextElements) {
      return ElementsChange.empty();
    }

    const added = new Map<string, Delta<ElementPartial>>();
    const removed = new Map<string, Delta<ElementPartial>>();
    const updated = new Map<string, Delta<ElementPartial>>();

    // this might be needed only in same edge cases, like during collab, when `isDeleted` elements get removed or when we (un)intentionally remove the elements
    for (const prevElement of prevElements.values()) {
      const nextElement = nextElements.get(prevElement.id);

      if (!nextElement) {
        const deleted = { ...prevElement, isDeleted: false } as ElementPartial;
        const inserted = { isDeleted: true } as ElementPartial;

        const delta = Delta.create(
          deleted,
          inserted,
          ElementsChange.stripIrrelevantProps,
        );

        removed.set(prevElement.id, delta);
      }
    }

    for (const nextElement of nextElements.values()) {
      const prevElement = prevElements.get(nextElement.id);

      if (!prevElement) {
        const deleted = { isDeleted: true } as ElementPartial;
        const inserted = {
          ...nextElement,
          isDeleted: false,
        } as ElementPartial;

        const delta = Delta.create(
          deleted,
          inserted,
          ElementsChange.stripIrrelevantProps,
        );

        added.set(nextElement.id, delta);

        continue;
      }

      if (prevElement.versionNonce !== nextElement.versionNonce) {
        const delta = Delta.calculate<ElementPartial>(
          prevElement,
          nextElement,
          ElementsChange.stripIrrelevantProps,
          // ElementsChange.postProcess,
        );

        if (
          // making sure we don't get here some non-boolean values (i.e. undefined, null, etc.)
          typeof prevElement.isDeleted === 'boolean' &&
          typeof nextElement.isDeleted === 'boolean' &&
          prevElement.isDeleted !== nextElement.isDeleted
        ) {
          // notice that other props could have been updated as well
          if (prevElement.isDeleted && !nextElement.isDeleted) {
            added.set(nextElement.id, delta);
          } else {
            removed.set(nextElement.id, delta);
          }

          continue;
        }

        // making sure there are at least some changes
        if (!Delta.isEmpty(delta)) {
          updated.set(nextElement.id, delta);
        }
      }
    }

    return ElementsChange.create(added, removed, updated);
  }

  private static satisfiesAddition = ({
    deleted,
    inserted,
  }: Delta<ElementPartial>) =>
    // dissallowing added as "deleted", which could cause issues when resolving conflicts
    deleted.isDeleted === true && !inserted.isDeleted;

  private static satisfiesRemoval = ({
    deleted,
    inserted,
  }: Delta<ElementPartial>) =>
    !deleted.isDeleted && inserted.isDeleted === true;

  private static satisfiesUpdate = ({
    deleted,
    inserted,
  }: Delta<ElementPartial>) => !!deleted.isDeleted === !!inserted.isDeleted;

  private static createGetter =
    (
      elements: SceneElementsMap,
      snapshot: Map<string, SerializedNode>,
      flags: {
        containsVisibleDifference: boolean;
        containsZindexDifference: boolean;
      },
    ) =>
    (id: string, partial: ElementPartial) => {
      let element = elements.get(id);

      if (!element) {
        // always fallback to the local snapshot, in cases when we cannot find the element in the elements array
        element = snapshot.get(id);

        if (element) {
          // as the element was brought from the snapshot, it automatically results in a possible zindex difference
          flags.containsZindexDifference = true;

          // as the element was force deleted, we need to check if adding it back results in a visible change
          if (
            partial.isDeleted === false ||
            (partial.isDeleted !== true && element.isDeleted === false)
          ) {
            flags.containsVisibleDifference = true;
          }
        }
      }

      return element;
    };

  private static createApplier = (
    nextElements: SceneElementsMap,
    snapshot: Map<string, SerializedNode>,
    flags: {
      containsVisibleDifference: boolean;
      containsZindexDifference: boolean;
    },
  ) => {
    const getElement = ElementsChange.createGetter(
      nextElements,
      snapshot,
      flags,
    );

    return (deltas: Map<string, Delta<ElementPartial>>) =>
      Array.from(deltas.entries()).reduce((acc, [id, delta]) => {
        const element = getElement(id, delta.inserted);

        if (element) {
          const newElement = ElementsChange.applyDelta(element, delta, flags);
          nextElements.set(newElement.id, newElement);
          acc.set(newElement.id, newElement);
        }

        return acc;
      }, new Map<string, SerializedNode>());
  };

  /**
   * Check for visible changes regardless of whether they were removed, added or updated.
   */
  private static checkForVisibleDifference(
    element: SerializedNode,
    partial: ElementPartial,
  ) {
    if (element.isDeleted && partial.isDeleted !== false) {
      // when it's deleted and partial is not false, it cannot end up with a visible change
      return false;
    }

    if (element.isDeleted && partial.isDeleted === false) {
      // when we add an element, it results in a visible change
      return true;
    }

    if (element.isDeleted === false && partial.isDeleted) {
      // when we remove an element, it results in a visible change
      return true;
    }

    // check for any difference on a visible element
    return Delta.isRightDifferent(element, partial);
  }

  private static applyDelta(
    element: SerializedNode,
    delta: Delta<ElementPartial>,
    flags: {
      containsVisibleDifference: boolean;
      containsZindexDifference: boolean;
    } = {
      // by default we don't care about about the flags
      containsVisibleDifference: true,
      containsZindexDifference: true,
    },
  ) {
    const { ...directlyApplicablePartial } = delta.inserted;

    // if (
    //   delta.deleted.boundElements?.length ||
    //   delta.inserted.boundElements?.length
    // ) {
    //   const mergedBoundElements = Delta.mergeArrays(
    //     element.boundElements,
    //     delta.inserted.boundElements,
    //     delta.deleted.boundElements,
    //     (x) => x.id,
    //   );

    //   Object.assign(directlyApplicablePartial, {
    //     boundElements: mergedBoundElements,
    //   });
    // }

    // if (isImageElement(element)) {
    //   const _delta = delta as Delta<ElementPartial<ExcalidrawImageElement>>;
    //   // we want to override `crop` only if modified so that we don't reset
    //   // when undoing/redoing unrelated change
    //   if (_delta.deleted.crop || _delta.inserted.crop) {
    //     Object.assign(directlyApplicablePartial, {
    //       // apply change verbatim
    //       crop: _delta.inserted.crop ?? null,
    //     });
    //   }
    // }

    if (!flags.containsVisibleDifference) {
      // strip away fractional as even if it would be different, it doesn't have to result in visible change
      const { index, ...rest } = directlyApplicablePartial;
      const containsVisibleDifference =
        ElementsChange.checkForVisibleDifference(element, rest);

      flags.containsVisibleDifference = containsVisibleDifference;
    }

    if (!flags.containsZindexDifference) {
      flags.containsZindexDifference =
        delta.deleted.index !== delta.inserted.index;
    }

    return newElementWith(element, directlyApplicablePartial);
  }

  public static create(
    added: Map<string, Delta<ElementPartial>>,
    removed: Map<string, Delta<ElementPartial>>,
    updated: Map<string, Delta<ElementPartial>>,
    options = { shouldRedistribute: false },
  ) {
    let change: ElementsChange;

    if (options.shouldRedistribute) {
      const nextAdded = new Map<string, Delta<ElementPartial>>();
      const nextRemoved = new Map<string, Delta<ElementPartial>>();
      const nextUpdated = new Map<string, Delta<ElementPartial>>();

      const deltas = [...added, ...removed, ...updated];

      for (const [id, delta] of deltas) {
        if (this.satisfiesAddition(delta)) {
          nextAdded.set(id, delta);
        } else if (this.satisfiesRemoval(delta)) {
          nextRemoved.set(id, delta);
        } else {
          nextUpdated.set(id, delta);
        }
      }

      change = new ElementsChange(nextAdded, nextRemoved, nextUpdated);
    } else {
      change = new ElementsChange(added, removed, updated);
    }

    return change;
  }

  private constructor(
    private readonly added: Map<string, Delta<ElementPartial>>,
    private readonly removed: Map<string, Delta<ElementPartial>>,
    private readonly updated: Map<string, Delta<ElementPartial>>,
  ) {}

  inverse(): ElementsChange {
    const inverseInternal = (deltas: Map<string, Delta<ElementPartial>>) => {
      const inversedDeltas = new Map<string, Delta<ElementPartial>>();

      for (const [id, delta] of deltas.entries()) {
        inversedDeltas.set(id, Delta.create(delta.inserted, delta.deleted));
      }

      return inversedDeltas;
    };

    const added = inverseInternal(this.added);
    const removed = inverseInternal(this.removed);
    const updated = inverseInternal(this.updated);

    // notice we inverse removed with added not to break the invariants
    return ElementsChange.create(removed, added, updated);
  }

  /**
   * Update delta/s based on the existing elements.
   *
   * @param elements current elements
   * @param modifierOptions defines which of the delta (`deleted` or `inserted`) will be updated
   * @returns new instance with modified delta/s
   */
  public applyLatestChanges(elements: SceneElementsMap): ElementsChange {
    const modifier = (element: SerializedNode) => (partial: ElementPartial) => {
      // (element: OrderedSerializedNode) => (partial: ElementPartial) => {
      const latestPartial: { [key: string]: unknown } = {};

      for (const key of Object.keys(partial) as Array<keyof typeof partial>) {
        // do not update following props:
        // - `boundElements`, as it is a reference value which is postprocessed to contain only deleted/inserted keys
        switch (key) {
          // case 'boundElements':
          //   latestPartial[key] = partial[key];
          //   break;
          default:
            latestPartial[key] = element[key];
        }
      }

      return latestPartial;
    };

    const applyLatestChangesInternal = (
      deltas: Map<string, Delta<ElementPartial>>,
    ) => {
      const modifiedDeltas = new Map<string, Delta<ElementPartial>>();

      for (const [id, delta] of deltas.entries()) {
        const existingElement = elements.get(id);

        if (existingElement) {
          const modifiedDelta = Delta.create(
            delta.deleted,
            delta.inserted,
            modifier(existingElement),
            'inserted',
          );

          modifiedDeltas.set(id, modifiedDelta);
        } else {
          modifiedDeltas.set(id, delta);
        }
      }

      return modifiedDeltas;
    };

    const added = applyLatestChangesInternal(this.added);
    const removed = applyLatestChangesInternal(this.removed);
    const updated = applyLatestChangesInternal(this.updated);

    return ElementsChange.create(added, removed, updated, {
      shouldRedistribute: true, // redistribute the deltas as `isDeleted` could have been updated
    });
  }

  applyTo(
    elements: SceneElementsMap,
    snapshot: Map<string, SerializedNode>,
  ): [SceneElementsMap, boolean] {
    let nextElements = new Map(elements);
    let changedElements: Map<string, SerializedNode>;

    const flags = {
      containsVisibleDifference: false,
      containsZindexDifference: false,
    };

    const applyDeltas = ElementsChange.createApplier(
      nextElements,
      snapshot,
      flags,
    );

    const addedElements = applyDeltas(this.added);
    const removedElements = applyDeltas(this.removed);
    const updatedElements = applyDeltas(this.updated);

    console.log('addedElements', addedElements);
    console.log('removedElements', removedElements);
    console.log('updatedElements', updatedElements);

    const affectedElements = this.resolveConflicts(elements, nextElements);

    // TODO: #7348 validate elements semantically and syntactically the changed elements, in case they would result data integrity issues
    changedElements = new Map([
      ...addedElements,
      ...removedElements,
      ...updatedElements,
      ...affectedElements,
    ]);

    // the following reorder performs also mutations, but only on new instances of changed elements
    // (unless something goes really bad and it fallbacks to fixing all invalid indices)
    // nextElements = ElementsChange.reorderElements(
    //   nextElements,
    //   changedElements,
    //   flags,
    // );

    return [nextElements, flags.containsVisibleDifference];
  }

  isEmpty(): boolean {
    return (
      this.added.size === 0 &&
      this.removed.size === 0 &&
      this.updated.size === 0
    );
  }

  /**
   * Resolves conflicts for all previously added, removed and updated elements.
   * Updates the previous deltas with all the changes after conflict resolution.
   *
   * @returns all elements affected by the conflict resolution
   */
  private resolveConflicts(
    prevElements: SceneElementsMap,
    nextElements: SceneElementsMap,
  ) {
    const nextAffectedElements = new Map<string, OrderedSerializedNode>();
    const updater = (
      element: SerializedNode,
      updates: ElementUpdate<SerializedNode>,
    ) => {
      const nextElement = nextElements.get(element.id); // only ever modify next element!
      if (!nextElement) {
        return;
      }

      let affectedElement: OrderedSerializedNode;

      if (prevElements.get(element.id) === nextElement) {
        // create the new element instance in case we didn't modify the element yet
        // so that we won't end up in an incosistent state in case we would fail in the middle of mutations
        affectedElement = newElementWith(
          nextElement,
          updates as ElementUpdate<OrderedSerializedNode>,
        ) as OrderedSerializedNode;
      } else {
        console.log('mutateElement', nextElement, updates);

        // affectedElement = mutateElement(
        //   nextElement,
        //   updates as ElementUpdate<OrderedSerializedNode>,
        // ) as OrderedSerializedNode;
      }

      nextAffectedElements.set(affectedElement.id, affectedElement);
      nextElements.set(affectedElement.id, affectedElement);
    };

    // // removed delta is affecting the bindings always, as all the affected elements of the removed elements need to be unbound
    // for (const [id] of this.removed) {
    //   ElementsChange.unbindAffected(prevElements, nextElements, id, updater);
    // }

    // // added delta is affecting the bindings always, all the affected elements of the added elements need to be rebound
    // for (const [id] of this.added) {
    //   ElementsChange.rebindAffected(prevElements, nextElements, id, updater);
    // }

    // updated delta is affecting the binding only in case it contains changed binding or bindable property
    // .filter(([_, delta]) =>
    //   Object.keys({ ...delta.deleted, ...delta.inserted }).find((prop) =>
    //     bindingProperties.has(prop as BindingProp | BindableProp),
    //   ),
    // )
    for (const [id] of Array.from(this.updated)) {
      const updatedElement = nextElements.get(id);
      if (!updatedElement || updatedElement.isDeleted) {
        // skip fixing bindings for updates on deleted elements
        continue;
      }

      updater(updatedElement, updatedElement);

      // ElementsChange.rebindAffected(prevElements, nextElements, id, updater);
    }

    // filter only previous elements, which were now affected
    const prevAffectedElements = new Map(
      Array.from(prevElements).filter(([id]) => nextAffectedElements.has(id)),
    );

    // calculate complete deltas for affected elements, and assign them back to all the deltas
    // technically we could do better here if perf. would become an issue
    const { added, removed, updated } = ElementsChange.calculate(
      prevAffectedElements,
      nextAffectedElements,
    );

    for (const [id, delta] of added) {
      this.added.set(id, delta);
    }

    for (const [id, delta] of removed) {
      this.removed.set(id, delta);
    }

    for (const [id, delta] of updated) {
      this.updated.set(id, delta);
    }

    return nextAffectedElements;
  }
}

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing. Note: this will trigger the component to update. Make sure you
// are calling it either from a React event handler or within unstable_batchedUpdates().
export const mutateElement = <TElement extends Mutable<SerializedNode>>(
  entity: Entity,
  element: TElement,
  updates: ElementUpdate<TElement>,
): TElement => {
  let didChange = false;

  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== 'undefined') {
      (element as any)[key] = value;
      didChange = true;
    }
  }

  if (!didChange) {
    return element;
  }

  const { name, visibility } = updates;
  const {
    fill,
    stroke,
    strokeWidth,
    strokeCap,
    strokeJoin,
    strokeAlignment,
    fontSize,
  } = updates as any;

  console.log('updates', updates);

  if (!isNil(name)) {
    entity.write(Name).value = name;
  }
  if (!isNil(visibility)) {
    entity.write(Visibility).value = visibility;
  }
  if (!isNil(fill)) {
    entity.write(FillSolid).value = fill;
  }
  if (!isNil(stroke)) {
    entity.write(Stroke).color = stroke;
  }
  if (!isNil(strokeWidth)) {
    entity.write(Stroke).width = strokeWidth;
  }
  if (!isNil(strokeCap)) {
    entity.write(Stroke).linecap = strokeCap;
  }
  if (!isNil(strokeJoin)) {
    entity.write(Stroke).linejoin = strokeJoin;
  }
  if (!isNil(strokeAlignment)) {
    entity.write(Stroke).alignment = strokeAlignment;
  }
  if (!isNil(fontSize)) {
    entity.write(Text).fontSize = fontSize;
  }

  if (isNil(element.version)) {
    element.version = 0;
  }

  element.version++;
  element.versionNonce = randomInteger();
  element.updated = getUpdatedTimestamp();

  return element;
};
