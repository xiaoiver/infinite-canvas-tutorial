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
  Entity,
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
  Ellipse,
  ZIndex,
  ComputeZIndex,
  Path,
  Group,
  IconFont,
  IconFontSerializedNode,
  registerIconifyIconSet,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Iconfont', () => {
  it('should render iconfont correctly', async () => {

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
    // 把 import() 整模块交给注册（内部会解包 default、读 icons），避免仅取 .default 在部分打包器下为 undefined 导致表为空
    registerIconifyIconSet('pixelarticons', m);

    const app = new App();

    let $canvas: HTMLCanvasElement;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StartUpSystem);
      system((s) => s.before(ComputeZIndex))(StartUpSystem);
    };

    class StartUpSystem extends System {
      private readonly commands = new Commands(this);

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
            Ellipse,
            Visibility,
            Name,
            ZIndex,
            Group,
            IconFont,
            Path,
          ).write,
      );

      initialize(): void {
        $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;

        const api = new API(new DefaultStateManagement(), this.commands);

        canvasEntity = api.createCanvas({
          element: $canvas,
          width: 200,
          height: 200,
          devicePixelRatio: 1,
        });

        cameraEntity = api.createCamera({
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
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();

    await sleep(300);

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'iconfont',
    );

    await app.exit();
  });
});
