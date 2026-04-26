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
  DropShadow,
  ZIndex,
  ComputeZIndex,
  ExportFormat,
  Screenshot,
  Ellipse,
  Group,
  EllipseSerializedNode,
  GSerializedNode,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Export SVG', () => {
  it('should export variables correctly', (done) => {
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
            Ellipse,
            Visibility,
            Name,
            DropShadow,
            ZIndex,
            Group,
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

        api.setAppState({
          variables: {
            '--primary': { type: 'color', value: 'red' },
            '--secondary': { type: 'color', value: 'green' },
          },
        });

        const node1: EllipseSerializedNode = {
          id: '1',
          type: 'ellipse',
          fill: '$--primary',
          x: 0,
          y: 50,
          width: 200,
          height: 100,
          visibility: 'visible',
          zIndex: 0,
        };
        const node2: EllipseSerializedNode = {
          id: '2',
          parentId: '1',
          type: 'ellipse',
          fill: '$--secondary',
          x: 50,
          y: -50,
          width: 100,
          height: 200,
          stroke: 'black',
          strokeWidth: 10,
          strokeAlignment: 'center',
          strokeDasharray: '10 10',
          visibility: 'visible',
          zIndex: 0,
        };

        api.updateNodes([
          node1,
          node2,
        ]);
      }

      execute(): void {
        this.screenshots.added.forEach(async (screenshot) => {
          const { svg } = screenshot.read(Screenshot);

          const dir = `${__dirname}/snapshots`;
          expectToMatchSVGSnapshotWithDone(svg, dir, 'export-variables', done);

          setTimeout(() => {
            app.exit();
          });
        });
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    app.run().then(() => {
      sleep(300).then(() => {
        if (api) {
          api.export({ format: ExportFormat.SVG, download: false });
        }
      });
    });
  });
});
