import { SerializedNode } from '../utils';
import { Change } from './change';

import { Delta } from './change';

export type FractionalIndex = string & { _brand: 'franctionalIndex' };
export type Ordered<TElement extends SerializedNode> = TElement & {
  index: FractionalIndex;
};
export type OrderedSerializedNode = Ordered<SerializedNode>;

export type ElementPartial<TElement extends SerializedNode = SerializedNode> =
  Omit<Partial<TElement>, 'id' | 'version' | 'versionNonce' | 'updated'> & {
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
    private readonly added: Map<string, Delta<ElementPartial>>,
    private readonly removed: Map<string, Delta<ElementPartial>>,
    private readonly updated: Map<string, Delta<ElementPartial>>,
  ) {}

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

  public isEmpty(): boolean {
    return (
      this.added.size === 0 &&
      this.removed.size === 0 &&
      this.updated.size === 0
    );
  }

  public applyTo(
    elements: SceneElementsMap,
    snapshot: Map<string, OrderedSerializedNode>,
  ): [SceneElementsMap, boolean] {
    return [elements, false];
  }
}
