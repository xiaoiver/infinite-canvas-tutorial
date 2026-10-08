export interface PathCase {
  d: string;
  fill: boolean;
  parentScale: number;
}
type Stats = { builds: number; vertices: number };
interface Driver {
  scene(options: PathCase): Promise<void>;
  view(zoom: number, x: number, y: number): Promise<void>;
  bounds(): number[];
  stats(): Stats;
}

declare global {
  interface Window {
    pathTest: {
      render(options: PathCase): Promise<void>;
      zoom(value: number, pan?: number): Promise<void>;
      state(): Stats & { bounds: number[] };
    };
  }
}

export function installPathTest(driver: Driver) {
  let options: PathCase;
  const dpr = Number(new URLSearchParams(location.search).get('dpr')) || 1;
  const reference = document.querySelector<HTMLCanvasElement>('#reference')!;
  reference.width = 640 * dpr;
  reference.height = 320 * dpr;
  window.pathTest = {
    async render(next) {
      options = next;
      await driver.scene(next);
      await this.zoom(1);
    },
    async zoom(zoom, pan = 0) {
      const x = 100 * options.parentScale - 320 / zoom + pan;
      const y = -35 - 160 / zoom;
      await driver.view(zoom, x, y);
      const ctx = document
        .querySelector<HTMLCanvasElement>('#reference')!
        .getContext('2d')!;
      ctx.resetTransform();
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, reference.width, reference.height);
      ctx.setTransform(
        zoom * dpr,
        0,
        0,
        zoom * dpr,
        -x * zoom * dpr,
        -y * zoom * dpr,
      );
      const path = new Path2D();
      // Both shaders extrude strokes in world space, after the model transform.
      path.addPath(
        new Path2D(options.d),
        new DOMMatrix([options.parentScale, 0, 0, 1, 0, 0]),
      );
      ctx.fillStyle = ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'butt';
      if (options.fill) ctx.fill(path);
      else ctx.stroke(path);
    },
    state: () => ({ ...driver.stats(), bounds: driver.bounds() }),
  };
  document.querySelector('#status')!.textContent = 'Ready';
}
