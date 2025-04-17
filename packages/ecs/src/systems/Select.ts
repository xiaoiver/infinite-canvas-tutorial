import { Entity, System } from '@lastolivegames/becsy';
import { mat3, vec2 } from 'gl-matrix';
import { IPointData } from '@pixi/math';
import {
  Camera,
  Canvas,
  Children,
  ComputedCamera,
  Cursor,
  FillSolid,
  FractionalIndex,
  Input,
  InputPoint,
  Parent,
  Pen,
  Rect,
  Renderable,
  Stroke,
  Transform,
  Visibility,
  ZIndex,
} from '../components';
import { Commands } from '../commands/Commands';
import { ViewportCulling } from './ViewportCulling';
import { CameraControl } from './CameraControl';
export class Select extends System {
  private viewportCulling = this.attach(ViewportCulling);
  private cameraControl = this.attach(CameraControl);

  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  #selectionBrush: Entity;

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Canvas)
          .read.update.using(
            InputPoint,
            Input,
            Cursor,
            Camera,
            Transform,
            Parent,
            Children,
            Renderable,
            FillSolid,
            Stroke,
            Rect,
            Visibility,
            ZIndex,
          ).write,
    );
    this.query((q) => q.using(ComputedCamera, FractionalIndex).read);
  }

  execute() {
    this.cameras.current.forEach((entity) => {
      const camera = entity.read(Camera);

      if (!camera.canvas) {
        return;
      }

      const canvas = camera.canvas.hold();
      const { pen, inputPoints } = canvas.read(Canvas);

      if (pen !== Pen.SELECT) {
        if (this.#selectionBrush) {
          // Hide selection brush
          this.#selectionBrush.write(Visibility).value = 'hidden';
        }

        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'default';

      if (input.pointerDownTrigger) {
        if (!this.#selectionBrush) {
          this.#selectionBrush = this.commands
            .spawn(
              new Transform(),
              new Renderable(),
              new FillSolid('rgba(0, 0, 0, 0.2)'),
              new Stroke({ width: 1, color: 'black' }),
              new Rect(),
              new Visibility('hidden'),
              new ZIndex(Infinity),
            )
            .id()
            .hold();

          const camera = this.commands.entity(entity);
          camera.appendChild(this.commands.entity(this.#selectionBrush));

          this.commands.execute();
        }

        this.createEntity(InputPoint, {
          prevPoint: input.pointerViewport,
          canvas,
        });

        const [x, y] = input.pointerViewport;
        const { x: wx, y: wy } = this.cameraControl.viewport2Canvas(entity, {
          x,
          y,
        });

        const entities = this.viewportCulling.elementsFromBBox(
          entity,
          wx,
          wy,
          wx,
          wy,
        );
        console.log(entities);

        this.#selectionBrush.write(Visibility).value = 'visible';

        Object.assign(this.#selectionBrush.write(Rect), {
          x: wx,
          y: wy,
        });
      }

      inputPoints.forEach((point) => {
        const inputPoint = point.write(InputPoint);
        const [x, y] = input.pointerViewport;

        if (inputPoint.prevPoint[0] === x && inputPoint.prevPoint[1] === y) {
          return;
        }

        const { x: wx, y: wy } = this.cameraControl.viewport2Canvas(entity, {
          x,
          y,
        });

        const rect = this.#selectionBrush.write(Rect);

        Object.assign(rect, {
          width: wx - rect.x,
          height: wy - rect.y,
        });

        inputPoint.prevPoint = input.pointerViewport;
      });

      if (input.pointerUpTrigger) {
        for (const point of inputPoints) {
          point.delete();
        }
        this.#selectionBrush.write(Visibility).value = 'hidden';
      }
    });
  }

  private viewport2Canvas(
    entity: Entity,
    { x, y }: IPointData,
    viewProjectionMatrixInv: mat3,
  ): IPointData {
    const { width, height } = entity.read(Camera).canvas.read(Canvas);
    const canvas = vec2.transformMat3(
      vec2.create(),
      [(x / width) * 2 - 1, (1 - y / height) * 2 - 1],
      viewProjectionMatrixInv,
    );
    return { x: canvas[0], y: canvas[1] };
  }
}
