const uidCache: Record<string, number> = {
  default: -1,
};

type UIDNames = 'default' | 'pen';

export function uid(name: UIDNames = 'default'): number {
  if (uidCache[name] === undefined) {
    uidCache[name] = -1;
  }

  return ++uidCache[name];
}

export function hashCode(s: string) {
  return s.split('').reduce(function (a, b) {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
}

/** Resets the next unique identifier to 0. This is used for some tests, dont touch or things WILL explode :) */
// export function resetUids(): void {
//   for (const key in uidCache) {
//     delete uidCache[key];
//   }
// }
