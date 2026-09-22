import {
  regularPolygonInRect,
  regularPolygonPathInRect,
} from '../../packages/ecs/src/utils/polygon';

function bboxOfPath(d: string) {
  const nums = d
    .replace(/[MLZ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

describe('regularPolygonInRect', () => {
  it('returns null for invalid input', () => {
    expect(regularPolygonInRect(2, 100, 100)).toBeNull();
    expect(regularPolygonInRect(3, 0, 100)).toBeNull();
    expect(regularPolygonInRect(3, 100, 0)).toBeNull();
  });

  it.each([3, 5, 6])(
    'normalizes the geometry of a %i-sided polygon to the local origin',
    (sides) => {
      const result = regularPolygonInRect(sides, 100, 100)!;
      expect(result).not.toBeNull();

      const { minX, minY, maxX, maxY } = bboxOfPath(result.d);
      // Geometry bounding box must start at the local origin.
      expect(minX).toBeCloseTo(0, 2);
      expect(minY).toBeCloseTo(0, 2);
      // Reported width/height must match the geometry bounding box.
      expect(maxX - minX).toBeCloseTo(result.width, 2);
      expect(maxY - minY).toBeCloseTo(result.height, 2);
    },
  );

  it('keeps the polygon at the same position via offsets', () => {
    const sides = 3;
    const raw = regularPolygonPathInRect(sides, 100, 100);
    const normalized = regularPolygonInRect(sides, 100, 100)!;

    const rawBox = bboxOfPath(raw);
    // Shifting the inscribing-rect origin by the offsets reproduces the raw box.
    expect(normalized.offsetX).toBeCloseTo(rawBox.minX, 2);
    expect(normalized.offsetY).toBeCloseTo(rawBox.minY, 2);
  });
});
