import {
  Canvas,
  Path,
  Group,
  Theme,
  CheckboardStyle,
} from '../../../packages/core/src';
import { Mesh } from '../../../packages/core/src/drawcalls/Mesh';
import { SmoothPolyline } from '../../../packages/core/src/drawcalls/SmoothPolyline';
import { installPathTest } from './path-rendering';

const canvas = await new Canvas({
  canvas: document.querySelector<HTMLCanvasElement>('#actual')!,
  devicePixelRatio: 1,
  checkboardStyle: CheckboardStyle.NONE,
  themeColors: { [Theme.LIGHT]: { background: '#ffffff' } },
}).initialized;
const stats = { builds: 0, vertices: 0 };
for (const ctor of [Mesh, SmoothPolyline]) {
  const original = ctor.prototype.createGeometry;
  ctor.prototype.createGeometry = function () {
    original.call(this);
    stats.builds++;
    stats.vertices =
      this instanceof Mesh
        ? this.points.length / 2
        : this.pointsBuffer.length / 3;
  };
}
let group: Group, path: Path;
installPathTest({
  async scene(options) {
    if (group) canvas.removeChild(group);
    group = new Group();
    group.scale.x = options.parentScale;
    path = new Path({
      d: options.d,
      fill: options.fill ? 'black' : 'none',
      stroke: options.fill ? 'none' : 'black',
      strokeWidth: 3,
      strokeLinejoin: 'round',
      strokeLinecap: 'butt',
    });
    group.appendChild(path);
    canvas.appendChild(group);
  },
  async view(zoom, x, y) {
    canvas.camera.zoom = zoom;
    canvas.camera.x = x;
    canvas.camera.y = y;
    canvas.render();
  },
  bounds() {
    const { minX, minY, maxX, maxY } = path.getGeometryBounds();
    return [minX, minY, maxX, maxY];
  },
  stats: () => ({ ...stats }),
});
