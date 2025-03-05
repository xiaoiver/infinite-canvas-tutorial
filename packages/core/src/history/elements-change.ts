import { newElementWith, SerializedNode } from '../utils';
import { Change } from './change';

import { Delta } from './change';
import { mutateElement } from './mutate';

export type FractionalIndex = string & { _brand: 'franctionalIndex' };
export type Ordered<TElement extends SerializedNode> = TElement & {
  // index: FractionalIndex;
};
export type OrderedSerializedNode = Ordered<SerializedNode>;

type HasBrand<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  [K in keyof T]: K extends `~brand${infer _}` ? true : never;
}[keyof T];

type RemoveAllBrands<T> = HasBrand<T> extends true
  ? {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      [K in keyof T as K extends `~brand~${infer _}` ? never : K]: T[K];
    }
  : never;
// adapted from https://github.com/colinhacks/zod/discussions/1994#discussioncomment-6068940
// currently does not cover all types (e.g. tuples, promises...)
type Unbrand<T> = T extends Map<infer E, infer F>
  ? Map<E, F>
  : T extends Set<infer E>
  ? Set<E>
  : T extends Array<infer E>
  ? Array<E>
  : RemoveAllBrands<T>;

/**
 * Makes type into a branded type, ensuring that value is assignable to
 * the base ubranded type. Optionally you can explicitly supply current value
 * type to combine both (useful for composite branded types. Make sure you
 * compose branded types which are not composite themselves.)
 */
export const toBrandedType = <BrandedType, CurrentType = BrandedType>(
  value: Unbrand<BrandedType>,
) => {
  return value as CurrentType & BrandedType;
};

export type ElementPartial<TElement extends SerializedNode = SerializedNode> =
  Omit<Partial<TElement>, 'uid' | 'version' | 'versionNonce' | 'updated'> & {
    isDeleted?: boolean;
    /** String in a fractional form defined by https://github.com/rocicorp/fractional-indexing.
      Used for ordering in multiplayer scenarios, such as during reconciliation or undo / redo.
      Always kept in sync with the array order by `syncMovedIndices` and `syncInvalidIndices`.
      Could be null, i.e. for new elements which were not yet assigned to the scene. */
    index?: FractionalIndex | null;
  };

export type SceneElementsMap = Map<SerializedNode['uid'], SerializedNode>;

/**
 * Elements change is a low level primitive to capture a change between two sets of elements.
 * It does so by encapsulating forward and backward `Delta`s, allowing to time-travel in both directions.
 */
export class ElementsChange implements Change<SceneElementsMap> {
  private constructor(
    private readonly added: Map<number, Delta<ElementPartial>>,
    private readonly removed: Map<number, Delta<ElementPartial>>,
    private readonly updated: Map<number, Delta<ElementPartial>>,
  ) {}

  public static create(
    added: Map<number, Delta<ElementPartial>>,
    removed: Map<number, Delta<ElementPartial>>,
    updated: Map<number, Delta<ElementPartial>>,
    options = { shouldRedistribute: false },
  ) {
    let change: ElementsChange;

    if (options.shouldRedistribute) {
      const nextAdded = new Map<number, Delta<ElementPartial>>();
      const nextRemoved = new Map<number, Delta<ElementPartial>>();
      const nextUpdated = new Map<number, Delta<ElementPartial>>();

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

  /**
   * Check for visible changes regardless of whether they were removed, added or updated.
   */
  private static checkForVisibleDifference(
    element: OrderedSerializedNode,
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
    return Delta.isRightDifferent(element, partial as SerializedNode);
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

  public inverse(): ElementsChange {
    const inverseInternal = (deltas: Map<number, Delta<ElementPartial>>) => {
      const inversedDeltas = new Map<number, Delta<ElementPartial>>();

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

  public isEmpty(): boolean {
    return (
      this.added.size === 0 &&
      this.removed.size === 0 &&
      this.updated.size === 0
    );
  }

  public applyTo(
    elements: SceneElementsMap,
    snapshot: Map<number, OrderedSerializedNode>,
  ): [SceneElementsMap, boolean] {
    let nextElements = toBrandedType<SceneElementsMap>(new Map(elements));
    let changedElements: Map<number, OrderedSerializedNode>;

    const flags = {
      containsVisibleDifference: false,
      containsZindexDifference: false,
    };

    // mimic a transaction by applying deltas into `nextElements` (always new instance, no mutation)
    try {
      const applyDeltas = ElementsChange.createApplier(
        nextElements,
        snapshot,
        flags,
      );

      const addedElements = applyDeltas(this.added);
      const removedElements = applyDeltas(this.removed);
      const updatedElements = applyDeltas(this.updated);

      const affectedElements = this.resolveConflicts(elements, nextElements);

      // TODO: #7348 validate elements semantically and syntactically the changed elements, in case they would result data integrity issues
      changedElements = new Map([
        ...addedElements,
        ...removedElements,
        ...updatedElements,
        ...affectedElements,
      ]);
    } catch (e) {
      console.error(`Couldn't apply elements change`, e);

      // should not really happen, but just in case we cannot apply deltas, let's return the previous elements with visible change set to `true`
      // even though there is obviously no visible change, returning `false` could be dangerous, as i.e.:
      // in the worst case, it could lead into iterating through the whole stack with no possibility to redo
      // instead, the worst case when returning `true` is an empty undo / redo
      return [elements, true];
    }

    try {
      // TODO: #7348 refactor away mutations below, so that we couldn't end up in an incosistent state
      // ElementsChange.redrawTextBoundingBoxes(nextElements, changedElements);
      // the following reorder performs also mutations, but only on new instances of changed elements
      // (unless something goes really bad and it fallbacks to fixing all invalid indices)
      // nextElements = ElementsChange.reorderElements(
      //   nextElements,
      //   changedElements,
      //   flags,
      // );
      // Need ordered nextElements to avoid z-index binding issues
      // ElementsChange.redrawBoundArrows(nextElements, changedElements);
    } catch (e) {
      console.error(
        `Couldn't mutate elements after applying elements change`,
        e,
      );
    } finally {
      return [nextElements, flags.containsVisibleDifference];
    }
  }

  /**
   * Update delta/s based on the existing elements.
   *
   * @param elements current elements
   * @param modifierOptions defines which of the delta (`deleted` or `inserted`) will be updated
   * @returns new instance with modified delta/s
   */
  public applyLatestChanges(elements: SceneElementsMap): ElementsChange {
    const modifier =
      (element: OrderedSerializedNode) => (partial: ElementPartial) => {
        const latestPartial: { [key: string]: unknown } = {};

        for (const key of Object.keys(partial) as Array<keyof typeof partial>) {
          // do not update following props:
          // - `boundElements`, as it is a reference value which is postprocessed to contain only deleted/inserted keys
          switch (key) {
            // case "boundElements":
            //   latestPartial[key] = partial[key];
            //   break;
            default:
              latestPartial[key] = element[key];
          }
        }

        return latestPartial;
      };

    const applyLatestChangesInternal = (
      deltas: Map<number, Delta<ElementPartial>>,
    ) => {
      const modifiedDeltas = new Map<number, Delta<ElementPartial>>();

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

  private static createApplier = (
    nextElements: SceneElementsMap,
    snapshot: Map<number, OrderedSerializedNode>,
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

    return (deltas: Map<number, Delta<ElementPartial>>) =>
      Array.from(deltas.entries()).reduce((acc, [id, delta]) => {
        const element = getElement(id, delta.inserted);

        if (element) {
          const newElement = ElementsChange.applyDelta(element, delta, flags);
          nextElements.set(newElement.uid, newElement);
          acc.set(newElement.uid, newElement);
        }

        return acc;
      }, new Map<number, OrderedSerializedNode>());
  };

  private static createGetter =
    (
      elements: SceneElementsMap,
      snapshot: Map<number, OrderedSerializedNode>,
      flags: {
        containsVisibleDifference: boolean;
        containsZindexDifference: boolean;
      },
    ) =>
    (id: number, partial: ElementPartial) => {
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

  private static applyDelta(
    element: OrderedSerializedNode,
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
    const nextAffectedElements = new Map<number, OrderedSerializedNode>();
    const updater = (
      element: SerializedNode,
      updates: ElementPartial<SerializedNode>,
    ) => {
      const nextElement = nextElements.get(element.uid); // only ever modify next element!
      if (!nextElement) {
        return;
      }

      let affectedElement: OrderedSerializedNode;

      if (prevElements.get(element.uid) === nextElement) {
        // create the new element instance in case we didn't modify the element yet
        // so that we won't end up in an incosistent state in case we would fail in the middle of mutations
        affectedElement = newElementWith(
          nextElement,
          updates as ElementPartial<OrderedSerializedNode>,
        );
      } else {
        affectedElement = mutateElement(
          nextElement,
          updates as ElementPartial<OrderedSerializedNode>,
        );
      }

      nextAffectedElements.set(affectedElement.uid, affectedElement);
      nextElements.set(affectedElement.uid, affectedElement);
    };

    // // removed delta is affecting the bindings always, as all the affected elements of the removed elements need to be unbound
    // for (const [id] of this.removed) {
    //   ElementsChange.unbindAffected(prevElements, nextElements, id, updater);
    // }

    // // added delta is affecting the bindings always, all the affected elements of the added elements need to be rebound
    // for (const [id] of this.added) {
    //   ElementsChange.rebindAffected(prevElements, nextElements, id, updater);
    // }

    // // updated delta is affecting the binding only in case it contains changed binding or bindable property
    // for (const [id] of Array.from(this.updated).filter(([_, delta]) =>
    //   Object.keys({ ...delta.deleted, ...delta.inserted }).find((prop) =>
    //     bindingProperties.has(prop as BindingProp | BindableProp),
    //   ),
    // )) {
    //   const updatedElement = nextElements.get(id);
    //   if (!updatedElement || updatedElement.isDeleted) {
    //     // skip fixing bindings for updates on deleted elements
    //     continue;
    //   }

    //   ElementsChange.rebindAffected(prevElements, nextElements, id, updater);
    // }

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

  /**
   * Calculates the `Delta`s between the previous and next set of elements.
   *
   * @param prevElements - Map representing the previous state of elements.
   * @param nextElements - Map representing the next state of elements.
   *
   * @returns `ElementsChange` instance representing the `Delta` changes between the two sets of elements.
   */
  public static calculate<T extends OrderedSerializedNode>(
    prevElements: Map<number, T>,
    nextElements: Map<number, T>,
  ): ElementsChange {
    if (prevElements === nextElements) {
      return ElementsChange.empty();
    }

    const added = new Map<number, Delta<ElementPartial>>();
    const removed = new Map<number, Delta<ElementPartial>>();
    const updated = new Map<number, Delta<ElementPartial>>();

    // this might be needed only in same edge cases, like during collab, when `isDeleted` elements get removed or when we (un)intentionally remove the elements
    for (const prevElement of prevElements.values()) {
      const nextElement = nextElements.get(prevElement.uid);

      if (!nextElement) {
        const deleted = { ...prevElement, isDeleted: false } as ElementPartial;
        const inserted = { isDeleted: true } as ElementPartial;

        const delta = Delta.create(
          deleted,
          inserted,
          ElementsChange.stripIrrelevantProps,
        );

        removed.set(prevElement.uid, delta);
      }
    }

    for (const nextElement of nextElements.values()) {
      const prevElement = prevElements.get(nextElement.uid);

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

        added.set(nextElement.uid, delta);

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
            added.set(nextElement.uid, delta);
          } else {
            removed.set(nextElement.uid, delta);
          }

          continue;
        }

        // making sure there are at least some changes
        if (!Delta.isEmpty(delta)) {
          updated.set(nextElement.uid, delta);
        }
      }
    }

    return ElementsChange.create(added, removed, updated);
  }

  public static empty() {
    return ElementsChange.create(new Map(), new Map(), new Map());
  }

  private static stripIrrelevantProps(
    partial: Partial<OrderedSerializedNode>,
  ): ElementPartial {
    const { uid, updated, version, versionNonce, ...strippedPartial } = partial;

    return strippedPartial;
  }
}
