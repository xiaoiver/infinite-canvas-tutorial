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
  ZIndex,
  ComputeZIndex,
  ExportFormat,
  Opacity,
  Screenshot,
  Text,
  TextDecoration,
  Line,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Export SVG', () => {
  it('should export text align correctly', (done) => {
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
            Opacity,
            ZIndex,
            Text,
            TextDecoration,
            Line
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
            id: 'baseline-1',
            type: 'line',
            x1: 50,
            y1: 0,
            x2: 50,
            y2: 200,
            stroke: 'red',
            strokeWidth: 1,
            zIndex: 0,
          },
          {
            id: 'text-1',
            type: 'text',
            fill: 'black',
            content: 'Test',
            anchorX: 50,
            anchorY: 50,
            fontSize: 16,
            fontFamily: 'sans-serif',
            zIndex: 1,
          },
          {
            id: 'text-2',
            type: 'text',
            fill: 'black',
            content: 'Test',
            anchorX: 50,
            anchorY: 100,
            fontSize: 16,
            fontFamily: 'sans-serif',
            textAlign: 'center',
            zIndex: 2,
          },
          {
            id: 'text-3',
            type: 'text',
            fill: 'black',
            content: 'Test',
            anchorX: 50,
            anchorY: 150,
            fontSize: 16,
            fontFamily: 'sans-serif',
            textAlign: 'right',
            zIndex: 3,
          },
        ]);
      }

      execute(): void {
        this.screenshots.added.forEach(async (screenshot) => {
          const { svg } = screenshot.read(Screenshot);

          const dir = `${__dirname}/snapshots`;
          expect(svg).toMatchSVGSnapshot(dir, 'export-text-align');

          setTimeout(() => {
            app.exit();
          });

          done();
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
