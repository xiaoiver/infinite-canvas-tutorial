import {
  App,
  Entity,
  Commands,
  System,
  Transform,
  Parent,
  Children,
  DefaultPlugins,
  GlobalTransform,
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
  Canvas,
  system,
  PreStartUp,
  API,
  DefaultStateManagement,
  Name,
  Pen,
  FillGradient,
  Selected,
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
      api,
    });
    api.createCamera({
      zoom: 1,
    });

    api.setPen(Pen.SELECT);
    api.setTaskbars([Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL]);

    api.updateNodes([
      {
        id: '1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fill: 'red',
      },
    ]);

    api.selectNodes(['1']);

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
