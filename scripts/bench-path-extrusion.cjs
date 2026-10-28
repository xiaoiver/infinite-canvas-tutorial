const { performance } = require('node:perf_hooks');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  buildPathExtrusionMesh,
} = require('../packages/ecs/lib/utils/path-extrusion-mesh.js');
const {
  parsePath,
} = require('../packages/ecs/lib/utils/curve/shape-path.js');
const {
  flattenPath,
} = require('../packages/ecs/lib/utils/curve/adaptive.js');
const {
  extrudePathContours,
} = require('../packages/ecs/lib/utils/geometry3d/extrude-path.js');

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

// Measure unique real contours separately from parsing, flattening and the
// shared mesh cache. This fixture includes concave and compound SVG paths.
const tigerSvg = readFileSync(
  join(__dirname, '../packages/lesson_013/examples/Ghostscript_Tiger.svg'),
  'utf8',
);
const tigerPaths = [...tigerSvg.matchAll(/<path\b[^>]*?\bd="([^"]+)"/g)].map(
  (match) => match[1],
);
const tigerContours = tigerPaths.map((d) => flattenPath(parsePath(d).subPaths, 2));
if (!tigerPaths.length) throw new Error('Tiger fixture has no paths');
const tigerSamples = [];
let successfulTigerMeshes = 0;
for (let run = 0; run < 9; run++) {
  const start = performance.now();
  let successful = 0;
  for (const contours of tigerContours)
    if (extrudePathContours(contours, 1).ok) successful++;
  if (run >= 2) tigerSamples.push(performance.now() - start);
  successfulTigerMeshes = successful;
}
const sortedTigerSamples = [...tigerSamples].sort((a, b) => a - b);
const tigerUniqueContours = {
  paths: tigerPaths.length,
  successfulMeshes: successfulTigerMeshes,
  flattenedPoints: tigerContours.reduce(
    (sum, contours) =>
      sum + contours.reduce((count, contour) => count + contour.length, 0),
    0,
  ),
  medianMs: Number(sortedTigerSamples[Math.floor(sortedTigerSamples.length / 2)].toFixed(2)),
  samplesMs: tigerSamples.map((ms) => Number(ms.toFixed(2))),
};

console.log(
  JSON.stringify(
    {
      segments: SEGMENTS,
      instances: INSTANCES,
      cold,
      repeated,
      edited,
      distinct,
      tigerUniqueContours,
    },
    null,
    2,
  ),
);
