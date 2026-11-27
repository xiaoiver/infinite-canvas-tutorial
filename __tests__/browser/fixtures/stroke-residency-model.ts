/** Numeric, optimistic transfer model only; owns no entities or GPU resources. */
export function createStrokeResidencyModel(budget: number) {
  if (!Number.isSafeInteger(budget) || budget < 0)
    throw new Error('Invalid residency budget');
  const entries = new Map<string, { version: number; bytes: number }>();
  let used = 0;
  return {
    get usedBytes() {
      return used;
    },
    clear() {
      entries.clear();
      used = 0;
    },
    page(
      parts: readonly { id: string; version: number; rows: number }[],
      packedBytes: number,
    ) {
      const pinned = new Set<string>();
      let rows = 0;
      for (const part of parts) {
        if (
          !part.id ||
          pinned.has(part.id) ||
          !Number.isSafeInteger(part.version) ||
          part.version < 1 ||
          !Number.isSafeInteger(part.rows) ||
          part.rows < 0
        )
          throw new Error('Invalid resident page');
        pinned.add(part.id);
        rows += part.rows;
      }
      if (
        !Number.isSafeInteger(rows * 80) ||
        !Number.isSafeInteger(packedBytes) ||
        packedBytes < 0
      )
        throw new Error('Invalid resident page size');
      const result = {
        hits: 0,
        misses: 0,
        invalidations: 0,
        evictions: 0,
        geometryBytes: 0,
        placementBytes: 0,
        fallbackBytes: 0,
        fallbackPages: 0,
        fallbackNodes: 0,
        emptyNodes: parts.filter((part) => !part.rows).length,
        peakBytes: used,
      };
      // Four RGBA32F texels/segment: 12 geometry + up to 3 travel floats,
      // padded to 16. Each visible segment additionally needs 4 floats for
      // resident row address, translation and painter order. No arena holes,
      // texture reallocation copies, limits or driver staging are modeled.
      if (rows * 64 > budget) {
        result.fallbackBytes = packedBytes;
        result.fallbackPages = 1;
        result.fallbackNodes = parts.length - result.emptyNodes;
        return result;
      }
      // Remove changed versions first. All current-page owners are pinned,
      // including ones visited later, so this page never invalidates itself.
      for (const part of parts) {
        const old = entries.get(part.id);
        if (
          old &&
          (old.version !== part.version || old.bytes !== part.rows * 64)
        ) {
          entries.delete(part.id);
          used -= old.bytes;
          result.invalidations++;
        }
      }
      for (const part of parts) {
        if (!part.rows) continue;
        const bytes = part.rows * 64;
        const old = entries.get(part.id);
        if (old) {
          result.hits++;
          entries.delete(part.id);
          entries.set(part.id, old);
        } else {
          while (used + bytes > budget) {
            const victim = [...entries].find(([id]) => !pinned.has(id));
            if (!victim) throw new Error('Pinned residency budget overflow');
            entries.delete(victim[0]);
            used -= victim[1].bytes;
            result.evictions++;
          }
          entries.set(part.id, { version: part.version, bytes });
          used += bytes;
          result.misses++;
          result.geometryBytes += bytes;
        }
        result.peakBytes = Math.max(result.peakBytes, used);
      }
      result.placementBytes = rows * 16;
      return result;
    },
  };
}
