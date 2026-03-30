export function assertNotNull<T>(it: T | null): asserts it is T {
  if (it === null) throw new Error('null');
}

export function assertNotUndefined<T>(it: T | undefined): asserts it is T {
  if (it === undefined) throw new Error('null');
}

export function mustExist<T>(it: T | null | undefined): T {
  assertNotNull(it);
  assertNotUndefined(it);
  return it;
}
