import _gl from 'gl';
import '../useSnapshotMatchers';
import {
  App,
  Camera,
  Canvas,
  Children,
  Commands,
  DOMAdapter,
  DefaultPlugins,
  DefaultStateManagement,
  FillSolid,
  Grid,
  Parent,
  Plugin,
  PreStartUp,
  Renderable,
  Stroke,
  System,
  Theme,
  Transform,
  Visibility,
  system,
  API,
  Name,
  Rect,
  DropShadow,
  ZIndex,
  ComputeZIndex,
  ExportFormat,
  Opacity,
  Screenshot,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Export SVG', () => {
  it('should export stroke alignment inner correctly', (done) => {
    const app = new App();

    let api: API | undefined;
    let $canvas: HTMLCanvasElement;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StartUpSystem);
      system((s) => s.before(ComputeZIndex))(StartUpSystem);
    };

    class StartUpSystem extends System {
      private readonly commands = new Commands(this);

      private readonly screenshots = this.query((q) =>
        q.added.with(Screenshot),
      );

      q = this.query(
        (q) =>
          q.using(
            Canvas,
            Theme,
            Grid,
            Camera,
            Parent,
            Children,
            Transform,
            Renderable,
            FillSolid,
            Stroke,
            Rect,
            Visibility,
            Name,
            DropShadow,
            Opacity,
            ZIndex,
          ).write,
      );

      initialize(): void {
        $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;

        api = new API(new DefaultStateManagement(), this.commands);

        api.createCanvas({
          element: $canvas,
          width: 200,
          height: 200,
          devicePixelRatio: 1,
        });
        api.createCamera({
          zoom: 1,
        });

        api.updateNodes([
          {
            id: '1',
            type: 'rect',
            fill: 'red',
            fillOpacity: 0.5,
            stroke: 'blue',
            strokeWidth: 10,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
            x: 50,
            y: 50,
            width: 100,
            height: 100,
          },
        ]);
      }

      execute(): void {
        this.screenshots.added.forEach(async (screenshot) => {
          const { svg } = screenshot.read(Screenshot);

          const dir = `${__dirname}/snapshots`;
          expect(svg).toMatchSVGSnapshot(dir, 'export-stroke-alignment-outer');

          setTimeout(() => {
            app.exit();
          });

          done();
        });
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    app.run().then(() => {
      sleep(300).then(() => {
        if (api) {
          api.export(ExportFormat.SVG, false);
        }
      });
    });
  });
});
