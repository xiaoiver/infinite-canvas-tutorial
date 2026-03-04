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
  it('should export text baseline correctly', (done) => {
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
        $canvas = DOMAdapter.get().createCanvas(500, 500) as HTMLCanvasElement;

        api = new API(new DefaultStateManagement(), this.commands);

        api.createCanvas({
          element: $canvas,
          width: 500,
          height: 500,
          devicePixelRatio: 1,
        });
        api.createCamera({
          zoom: 1,
        });

        api.updateNodes([
          {
            id: 'baseline-1',
            type: 'line',
            x1: 0,
            y1: 50,
            x2: 300,
            y2: 50,
            stroke: 'red',
            strokeWidth: 1,
            zIndex: 0,
          },
          {
            id: 'text-1',
            type: 'text',
            fill: 'black',
            content: 'Abcdefghijklmnop (top)',
            anchorX: 50,
            anchorY: 50,
            fontSize: 16,
            fontFamily: 'sans-serif',
            textBaseline: 'top',
            zIndex: 1,
          },
          {
            id: 'baseline-2',
            type: 'line',
            x1: 0,
            y1: 100,
            x2: 300,
            y2: 100,
            stroke: 'red',
            strokeWidth: 1,
            zIndex: 3,
          },
          {
            id: 'text-2',
            type: 'text',
            fill: 'black',
            content: 'Abcdefghijklmnop (hanging)',
            anchorX: 50,
            anchorY: 100,
            fontSize: 16,
            fontFamily: 'sans-serif',
            textBaseline: 'hanging',
            zIndex: 4,
          },
          {
            id: 'baseline-3',
            type: 'line',
            x1: 0,
            y1: 150,
            x2: 300,
            y2: 150,
            stroke: 'red',
            strokeWidth: 1,
            zIndex: 5,
          },
          {
            id: 'text-3',
            type: 'text',
            fill: 'black',
            content: 'Abcdefghijklmnop (middle)',
            anchorX: 50,
            anchorY: 150,
            fontSize: 16,
            fontFamily: 'sans-serif',
            textBaseline: 'middle',
            zIndex: 6,
          },
          {
            id: 'baseline-4',
            type: 'line',
            x1: 0,
            y1: 200,
            x2: 300,
            y2: 200,
            stroke: 'red',
            strokeWidth: 1,
            zIndex: 5,
          },
          {
            id: 'text-4',
            type: 'text',
            fill: 'black',
            content: 'Abcdefghijklmnop (alphabetic)',
            anchorX: 50,
            anchorY: 200,
            fontSize: 16,
            fontFamily: 'sans-serif',
            textBaseline: 'alphabetic',
            zIndex: 6,
          },
          {
            id: 'baseline-5',
            type: 'line',
            x1: 0,
            y1: 250,
            x2: 300,
            y2: 250,
            stroke: 'red',
            strokeWidth: 1,
            zIndex: 5,
          },
          {
            id: 'text-5',
            type: 'text',
            fill: 'black',
            content: 'Abcdefghijklmnop (ideographic)',
            anchorX: 50,
            anchorY: 250,
            fontSize: 16,
            fontFamily: 'sans-serif',
            textBaseline: 'ideographic',
            zIndex: 6,
          },
          {
            id: 'baseline-6',
            type: 'line',
            x1: 0,
            y1: 300,
            x2: 300,
            y2: 300,
            stroke: 'red',
            strokeWidth: 1,
            zIndex: 5,
          },
          {
            id: 'text-6',
            type: 'text',
            fill: 'black',
            content: 'Abcdefghijklmnop (bottom)',
            anchorX: 50,
            anchorY: 300,
            fontSize: 16,
            fontFamily: 'sans-serif',
            textBaseline: 'bottom',
            zIndex: 6,
          },
        ]);
      }

      execute(): void {
        this.screenshots.added.forEach(async (screenshot) => {
          const { svg } = screenshot.read(Screenshot);

          const dir = `${__dirname}/snapshots`;
          expectToMatchSVGSnapshotWithDone(svg, dir, 'export-text-baseline', done);

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
