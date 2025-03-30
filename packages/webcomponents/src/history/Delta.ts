/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/change.ts#L62
 */

/**
 * Represents the difference between two objects of the same type.
 *
 * Both `deleted` and `inserted` partials represent the same set of added, removed or updated properties, where:
 * - `deleted` is a set of all the deleted values
 * - `inserted` is a set of all the inserted (added, updated) values
 *
 * Keeping it as pure object (without transient state, side-effects, etc.), so we won't have to instantiate it on load.
 */
export class Delta<T> {
  private constructor(
    public readonly deleted: Partial<T>,
    public readonly inserted: Partial<T>,
  ) {}

  static create<T>(
    deleted: Partial<T>,
    inserted: Partial<T>,
    modifier?: (delta: Partial<T>) => Partial<T>,
    modifierOptions?: 'deleted' | 'inserted',
  ) {
    const modifiedDeleted =
      modifier && modifierOptions !== 'inserted' ? modifier(deleted) : deleted;
    const modifiedInserted =
      modifier && modifierOptions !== 'deleted' ? modifier(inserted) : inserted;

    return new Delta(modifiedDeleted, modifiedInserted);
  }

  /**
   * Compares if object1 contains any different value compared to the object2.
   */
  public static isLeftDifferent<T extends {}>(
    object1: T,
    object2: T,
    skipShallowCompare = false,
  ): boolean {
    const anyDistinctKey = this.distinctKeysIterator(
      'left',
      object1,
      object2,
      skipShallowCompare,
    ).next().value;

    return !!anyDistinctKey;
  }

  /**
   * Compares if object2 contains any different value compared to the object1.
   */
  public static isRightDifferent<T extends {}>(
    object1: T,
    object2: T,
    skipShallowCompare = false,
  ): boolean {
    const anyDistinctKey = this.distinctKeysIterator(
      'right',
      object1,
      object2,
      skipShallowCompare,
    ).next().value;

    return !!anyDistinctKey;
  }

  /**
   * Calculates the delta between two objects.
   *
   * @param prevObject - The previous state of the object.
   * @param nextObject - The next state of the object.
   *
   * @returns new delta instance.
   */
  public static calculate<T extends { [key: string]: any }>(
    prevObject: T,
    nextObject: T,
    modifier?: (partial: Partial<T>) => Partial<T>,
    postProcess?: (
      deleted: Partial<T>,
      inserted: Partial<T>,
    ) => [Partial<T>, Partial<T>],
  ): Delta<T> {
    if (prevObject === nextObject) {
      return Delta.empty();
    }

    const deleted = {} as Partial<T>;
    const inserted = {} as Partial<T>;

    // O(n^3) here for elements, but it's not as bad as it looks:
    // - we do this only on store recordings, not on every frame (not for ephemerals)
    // - we do this only on previously detected changed elements
    // - we do shallow compare only on the first level of properties (not going any deeper)
    // - # of properties is reasonably small
    for (const key of this.distinctKeysIterator(
      'full',
      prevObject,
      nextObject,
    )) {
      deleted[key as keyof T] = prevObject[key];
      inserted[key as keyof T] = nextObject[key];
    }

    const [processedDeleted, processedInserted] = postProcess
      ? postProcess(deleted, inserted)
      : [deleted, inserted];

    return Delta.create(processedDeleted, processedInserted, modifier);
  }

  public static empty() {
    return new Delta({}, {});
  }

  public static isEmpty<T>(delta: Delta<T>): boolean {
    return (
      !Object.keys(delta.deleted).length && !Object.keys(delta.inserted).length
    );
  }

  /**
   * Iterator comparing values of object properties based on the passed joining strategy.
   *
   * @yields keys of properties with different values
   *
   * WARN: it's based on shallow compare performed only on the first level and doesn't go deeper than that.
   */
  private static *distinctKeysIterator<T extends {}>(
    join: 'left' | 'right' | 'full',
    object1: T,
    object2: T,
    skipShallowCompare = false,
  ) {
    if (object1 === object2) {
      return;
    }

    let keys: string[] = [];

    if (join === 'left') {
      keys = Object.keys(object1);
    } else if (join === 'right') {
      keys = Object.keys(object2);
    } else if (join === 'full') {
      keys = Array.from(
        new Set([...Object.keys(object1), ...Object.keys(object2)]),
      );
    }

    for (const key of keys) {
      const object1Value = object1[key as keyof T];
      const object2Value = object2[key as keyof T];

      if (object1Value !== object2Value) {
        if (
          !skipShallowCompare &&
          typeof object1Value === 'object' &&
          typeof object2Value === 'object' &&
          object1Value !== null &&
          object2Value !== null &&
          isShallowEqual(object1Value, object2Value)
        ) {
          continue;
        }

        yield key;
      }
    }
  }
}

/**
 * Returns whether object/array is shallow equal.
 * Considers empty object/arrays as equal (whether top-level or second-level).
 */
export const isShallowEqual = <
  T extends Record<string, any>,
  K extends readonly unknown[],
>(
  objA: T,
  objB: T,
  comparators?:
    | { [key in keyof T]?: (a: T[key], b: T[key]) => boolean }
    | (keyof T extends K[number]
        ? K extends readonly (keyof T)[]
          ? K
          : {
              _error: 'keys are either missing or include keys not in compared obj';
            }
        : {
            _error: 'keys are either missing or include keys not in compared obj';
          }),
  debug = false,
) => {
  const aKeys = Object.keys(objA);
  const bKeys = Object.keys(objB);
  if (aKeys.length !== bKeys.length) {
    if (debug) {
      console.warn(
        `%cisShallowEqual: objects don't have same properties ->`,
        'color: #8B4000',
        objA,
        objB,
      );
    }
    return false;
  }

  if (comparators && Array.isArray(comparators)) {
    for (const key of comparators) {
      const ret =
        objA[key] === objB[key] ||
        _defaultIsShallowComparatorFallback(objA[key], objB[key]);
      if (!ret) {
        if (debug) {
          console.warn(
            `%cisShallowEqual: ${key} not equal ->`,
            'color: #8B4000',
            objA[key],
            objB[key],
          );
        }
        return false;
      }
    }
    return true;
  }

  return aKeys.every((key) => {
    const comparator = (
      comparators as { [key in keyof T]?: (a: T[key], b: T[key]) => boolean }
    )?.[key as keyof T];
    const ret = comparator
      ? comparator(objA[key], objB[key])
      : objA[key] === objB[key] ||
        _defaultIsShallowComparatorFallback(objA[key], objB[key]);

    if (!ret && debug) {
      console.warn(
        `%cisShallowEqual: ${key} not equal ->`,
        'color: #8B4000',
        objA[key],
        objB[key],
      );
    }
    return ret;
  });
};

/** use as a fallback after identity check (for perf reasons) */
const _defaultIsShallowComparatorFallback = (a: any, b: any): boolean => {
  // consider two empty arrays equal
  if (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === 0 &&
    b.length === 0
  ) {
    return true;
  }
  return a === b;
};
