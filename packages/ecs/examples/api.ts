import {
  App,
  Commands,
  System,
  Transform,
  Parent,
  Children,
  DefaultPlugins,
  Camera,
  Grid,
  Theme,
  Renderable,
  FillSolid,
  Circle,
  Rect,
  DropShadow,
  Stroke,
  Polyline,
  Path,
  Rough,
  Text,
  Wireframe,
  Opacity,
  Visibility,
  ZIndex,
  Canvas,
  system,
  PreStartUp,
  API,
  DefaultStateManagement,
  Name,
  Pen,
  FillGradient,
  Selected,
  RectSerializedNode,
  ComputeZIndex,
} from '../src';
import { Task } from '../src/context';

const $canvas = document.getElementById('canvas') as HTMLCanvasElement;
const resize = (width: number, height: number) => {
  $canvas.width = width * window.devicePixelRatio;
  $canvas.height = height * window.devicePixelRatio;
  $canvas.style.width = `${width}px`;
  $canvas.style.height = `${height}px`;
  $canvas.style.outline = 'none';
  $canvas.style.padding = '0px';
  $canvas.style.margin = '0px';
};
resize(window.innerWidth, window.innerHeight);

const MyPlugin = () => {
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
        FillGradient,
        Stroke,
        DropShadow,
        Circle,
        Rect,
        Polyline,
        Path,
        Rough,
        Text,
        Wireframe,
        Opacity,
        Visibility,
        ZIndex,
        Name,
        Selected,
      ).write,
  );

  initialize(): void {
    const api = new API(new DefaultStateManagement(), this.commands);

    api.createCanvas({
      element: $canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    });
    api.createCamera({
      zoom: 1,
    });

    api.setAppState({
      penbarSelected: Pen.SELECT,
      taskbarSelected: [Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL],
    });

    const node = {
      id: '1',
      type: 'rect',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: 'red',
    } as RectSerializedNode;
    api.updateNodes([node]);

    api.selectNodes([node]);

    api.record();

    // window.addEventListener('resize', () => {
    //   resize(window.innerWidth, window.innerHeight);

    //   Object.assign(canvasEntity.write(Canvas), {
    //     width: window.innerWidth,
    //     height: window.innerHeight,
    //   });
    // });
  }
}

new App().addPlugins(...DefaultPlugins, MyPlugin).run();
