/** Capture enumerable layout data by value, including mutable derived arrays. */
export function captureTextLayout(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(captureTextLayout);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        captureTextLayout(item),
      ]),
    );
  return value;
}

/** Compare without serializing strings/numbers or assuming metric objects are immutable. */
export function matchesTextLayout(
  snapshot: unknown,
  current: unknown,
): boolean {
  if (Object.is(snapshot, current)) return true;
  if (
    !snapshot ||
    !current ||
    typeof snapshot !== 'object' ||
    typeof current !== 'object'
  )
    return false;
  if (Array.isArray(snapshot)) {
    if (!Array.isArray(current) || snapshot.length !== current.length)
      return false;
    for (let i = 0; i < snapshot.length; i++)
      if (!matchesTextLayout(snapshot[i], current[i])) return false;
    return true;
  }
  if (Array.isArray(current)) return false;
  const previous = snapshot as Record<string, unknown>,
    next = current as Record<string, unknown>;
  const keys = Object.keys(previous);
  return (
    keys.length === Object.keys(next).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(next, key) &&
        matchesTextLayout(previous[key], next[key]),
    )
  );
}
