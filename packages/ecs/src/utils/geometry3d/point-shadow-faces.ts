/** Cube faces in the same order as the 3 × 2 point-shadow atlas. */
export const POINT_SHADOW_FACES = [
  { direction: [1, 0, 0], up: [0, -1, 0], right: [0, 0, -1] },
  { direction: [-1, 0, 0], up: [0, -1, 0], right: [0, 0, 1] },
  { direction: [0, 1, 0], up: [0, 0, 1], right: [1, 0, 0] },
  { direction: [0, -1, 0], up: [0, 0, -1], right: [1, 0, 0] },
  { direction: [0, 0, 1], up: [0, -1, 0], right: [1, 0, 0] },
  { direction: [0, 0, -1], up: [0, -1, 0], right: [-1, 0, 0] },
] as const;
