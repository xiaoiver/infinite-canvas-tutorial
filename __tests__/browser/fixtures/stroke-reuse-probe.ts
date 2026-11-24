/** Diagnostic-only synchronous CPU scopes; no renderer imports or production hooks. */
export function strokeReuseProbe(precision: object, geometry: object) {
  const empty = () => ({
    precisionCalls: 0,
    precisionMs: 0,
    geometryCalls: 0,
    geometryMs: 0,
    localCalls: 0,
    localMs: 0,
  });
  let work = empty();
  for (const [target, key, prefix] of [
    [precision, 'prepareGeometry', 'precision'],
    [geometry, 'createGeometry', 'geometry'],
    [geometry, 'getStrokeGeometry', 'local'],
  ] as const) {
    const methods = target as Record<string, (...args: any[]) => any>;
    const original = methods[key];
    methods[key] = function (...args: any[]) {
      const start = performance.now();
      try {
        return original.apply(this, args);
      } finally {
        work[`${prefix}Calls`]++;
        work[`${prefix}Ms`] += performance.now() - start;
      }
    };
  }
  return {
    reset() {
      work = empty();
    },
    snapshot: () => ({ ...work }),
  };
}
