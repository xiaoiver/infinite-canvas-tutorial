/** Unit cube centered at origin with per-face normals (24 verts, indexed). */
export function createCubeGeometry(size = 1) {
  const h = size / 2;
  const faces: {
    normal: [number, number, number];
    verts: [number, number, number][];
  }[] = [
    { normal: [0, 0, 1], verts: [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]] },
    { normal: [0, 0, -1], verts: [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]] },
    { normal: [0, 1, 0], verts: [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]] },
    { normal: [0, -1, 0], verts: [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]] },
    { normal: [1, 0, 0], verts: [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]] },
    { normal: [-1, 0, 0], verts: [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]] },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let base = 0;

  for (const { normal, verts } of faces) {
    for (const v of verts) {
      positions.push(...v);
      normals.push(...normal);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}
