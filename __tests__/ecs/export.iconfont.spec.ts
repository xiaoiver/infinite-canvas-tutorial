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
  IconFont,
  registerIconifyIconSet,
  IconFontSerializedNode,
  Path
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Export SVG', () => {
  it('should export iconfont correctly', (done) => {

    const m = {
      "prefix": "pixelarticons",
      "info": {
        "name": "Pixelarticons",
        "total": 800,
        "version": "2.1.0",
        "author": {
          "name": "Gerrit Halfmann",
          "url": "https://github.com/halfmage/pixelarticons"
        },
        "license": {
          "title": "MIT",
          "spdx": "MIT",
          "url": "https://github.com/halfmage/pixelarticons/blob/master/LICENSE"
        },
        "samples": [
          "home",
          "arrows-horizontal",
          "heart",
          "tab",
          "hash",
          "folder"
        ],
        "height": 24,
        "category": "UI 24px",
        "tags": [
          "Precise Shapes",
          "Has Padding"
        ],
        "palette": false
      },
      "lastModified": 1771998234,
      "icons": {
        "a-arrow-down": {
          "body": "<g fill=\"currentColor\"><path d=\"M16 6h2v12h-2zm2 8h2v2h-2zm-4 0h2v2h-2zm4-2h4v2h-4zm-6 0h4v2h-4zM2 8h2v10H2zm6 0h2v10H8z\"/><path d=\"M4 12h6v2H4zm0-6h4v2H4z\"/></g>"
        },
      },
      "width": 24,
      "height": 24
    }
    registerIconifyIconSet('pixelarticons', m);

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
            IconFont,
            Path,
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

        const node1: IconFontSerializedNode = {
          id: '1',
          type: 'iconfont',
          iconFontName: 'a-arrow-down',
          iconFontFamily: 'pixelarticons',
          x: 50,
          y: 50,
          width: 50,
          height: 50,
          zIndex: 0,
        };

        api.updateNodes([
          node1,
        ]);
      }

      execute(): void {
        this.screenshots.added.forEach(async (screenshot) => {
          const { svg } = screenshot.read(Screenshot);

          const dir = `${__dirname}/snapshots`;
          expectToMatchSVGSnapshotWithDone(svg, dir, 'export-iconfont', done);

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
