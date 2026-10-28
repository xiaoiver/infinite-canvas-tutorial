const { performance } = require('node:perf_hooks');
const {
  buildPathExtrusionMesh,
} = require('../packages/ecs/lib/utils/path-extrusion-mesh.js');

const SEGMENTS = 1000;
const INSTANCES = 20;

function wavePath(offset = 0) {
  const points = Array.from({ length: SEGMENTS }, (_, index) => {
    const angle = (index * Math.PI * 2) / SEGMENTS;
    const radius = 100 + 12 * Math.sin(angle * 19) + offset;
    return `${(radius * Math.cos(angle) + 120).toFixed(3)} ${(
      radius * Math.sin(angle) +
      120
    ).toFixed(3)}`;
  });
  return `M${points.join(' L')} Z`;
}

function build(path) {
  const mesh = buildPathExtrusionMesh(path);
  if (!mesh) throw new Error('Benchmark path did not extrude');
  return mesh;
}

function measure(paths) {
  const start = performance.now();
  const meshes = paths.map(build);
  return {
    milliseconds: Number((performance.now() - start).toFixed(2)),
    uniquePositionBuffers: new Set(
      meshes.map((mesh) => mesh.geometry.positions),
    ).size,
    vertexCount: meshes[0].geometry.positions.length / 3,
    indexCount: meshes[0].geometry.indices.length,
  };
}

const path = wavePath();
const cold = measure([path]);
const repeated = measure(Array(INSTANCES).fill(path));
const edited = measure([wavePath(0.001)]);
const distinct = measure(
  Array.from({ length: INSTANCES }, (_, index) => wavePath(index + 1)),
);

console.log(
  JSON.stringify(
    {
      segments: SEGMENTS,
      instances: INSTANCES,
      cold,
      repeated,
      edited,
      distinct,
    },
    null,
    2,
  ),
);
