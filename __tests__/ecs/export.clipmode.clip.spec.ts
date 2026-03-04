import _gl from 'gl';
import '../useSnapshotMatchers';
import { expectToMatchSVGSnapshotWithDone } from '../toMatchSVGSnapshot';
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
  FillImage,
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
  Screenshot,
  ClipMode,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Export SVG', () => {
  it('should export clipmode clip correctly', (done) => {
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
            FillImage,
            Stroke,
            Rect,
            Visibility,
            Name,
            DropShadow,
            ZIndex,
            ClipMode,
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
            id: 'clip-parent',
            type: 'rect',
            fill: 'red',
            clipMode: 'clip',
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            zIndex: 0,
          },
          {
            id: 'clip-child',
            parentId: 'clip-parent',
            type: 'rect',
            fill: 'green',
            x: 50,
            y: 50,
            width: 200,
            height: 200,
            zIndex: 0,
          },
        ]);
      }

      execute(): void {
        this.screenshots.added.forEach(async (screenshot) => {
          const { svg } = screenshot.read(Screenshot);

          const dir = `${__dirname}/snapshots`;
          expectToMatchSVGSnapshotWithDone(svg, dir, 'export-clipmode-clip', done);

          setTimeout(() => {
            app.exit();
          });
        });
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    app.run().then(() => {
      sleep(1000).then(() => {
        if (api) {
          api.export(ExportFormat.SVG, false);
        }
      });
    });
  });
});
