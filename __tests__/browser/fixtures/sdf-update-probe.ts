/** Count-only diagnostic; normal rendering has no SDF method wrappers. */
export async function collectSDFUpdates<T>(
  backend: 'core' | 'ecs',
  run: () => Promise<T>,
) {
  const { SDF } =
    backend === 'core'
      ? await import('../../../packages/core/src/drawcalls/SDF')
      : await import('../../../packages/ecs/src/drawcalls/SDF');
  const target = SDF.prototype as unknown as Record<
    string,
    (...args: any[]) => any
  >;
  const counts = { geometryBuilds: 0, packedRows: 0 };
  const restore: (() => void)[] = [];
  try {
    for (const [method, counter] of [
      ['createGeometry', 'geometryBuilds'],
      ['generateBuffer', 'packedRows'],
    ] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(target, method)!;
      const original = target[method];
      Object.defineProperty(target, method, {
        ...descriptor,
        value: function (this: { instanced: boolean }, ...args: any[]) {
          if (this.instanced) counts[counter]++;
          return original.apply(this, args);
        },
      });
      restore.push(() => Object.defineProperty(target, method, descriptor));
    }
    return { counts, result: await run() };
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
}
