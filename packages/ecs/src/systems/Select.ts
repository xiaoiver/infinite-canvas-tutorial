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
  Input,
  InputPoint,
  Parent,
  Pen,
  Rect,
  Renderable,
  Stroke,
  Transform,
  // Visibility,
} from '../components';
import { Commands } from '../commands/Commands';

import { CameraControl } from './CameraControl';

export class Select extends System {
  private readonly commands = new Commands(this);

  // private readonly input = this.singleton.write(Input);
  // private readonly cursor = this.singleton.write(Cursor);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);
  // private readonly points = this.query((q) => q.current.with(InputPoint).write);

  #selectionBrush: Entity;

  constructor() {
    super();
    this.query(
      (q) =>
        q.using(
          Camera,
          Transform,
          Parent,
          Children,
          Renderable,
          FillSolid,
          Stroke,
          Rect,
        ).write,
    );
    this.query((q) => q.using(ComputedCamera, Canvas).read);

    this.schedule((s) => s.after(CameraControl));
  }

  execute() {
    // this.cursor.value = 'default';

    this.cameras.current.forEach((entity) => {
      const canvas = entity.read(Camera).canvas.read(Canvas);

      if (canvas.pen !== Pen.SELECT) {
        // Hide selection brush
        // this.#selectionBrush?.add(Visibility.Hidden);

        return;
      }

      // const { viewProjectionMatrixInv } = entity.read(ComputedCamera);

      // if (!this.#selectionBrush) {
      //   this.#selectionBrush = this.commands
      //     .spawn(
      //       new Transform(),
      //       new Renderable(),
      //       new FillSolid('rgba(0, 0, 0, 0.2)'),
      //       new Stroke({ width: 1, color: 'black' }),
      //       new Rect(),
      //     )
      //     .id()
      //     .hold();

      //   const camera = this.commands.entity(entity);
      //   camera.appendChild(this.commands.entity(this.#selectionBrush));

      //   this.commands.execute();
      // }

      // if (this.input.pointerDownTrigger) {
      //   this.createEntity(InputPoint, {
      //     prevPoint: this.input.pointerWorld,
      //   });

      //   // this.#selectionBrush.add(Visibility.Visible);

      //   Object.assign(
      //     this.#selectionBrush.write(Rect),
      //     this.viewport2Canvas(
      //       entity,
      //       {
      //         x: this.input.pointerWorld[0],
      //         y: this.input.pointerWorld[1],
      //       },
      //       viewProjectionMatrixInv,
      //     ),
      //   );
      // }

      // for (const point of this.points.current) {
      //   const stroke = point.write(InputPoint);
      //   stroke.prevPoint = this.input.pointerWorld;
      //   const start = [stroke.prevPoint[0], stroke.prevPoint[1]] as [
      //     number,
      //     number,
      //   ];
      //   const end = [
      //     Math.round(this.input.pointerWorld[0]),
      //     Math.round(this.input.pointerWorld[1]),
      //   ] as [number, number];

      //   // console.log(start, end);

      //   const { x, y } = this.#selectionBrush.write(Rect);
      //   const { x: canvasX, y: canvasY } = this.viewport2Canvas(
      //     entity,
      //     {
      //       x: this.input.pointerWorld[0],
      //       y: this.input.pointerWorld[1],
      //     },
      //     viewProjectionMatrixInv,
      //   );

      //   Object.assign(this.#selectionBrush.write(Rect), {
      //     width: canvasX - x,
      //     height: canvasY - y,
      //   });
      // }

      // if (this.input.pointerUpTrigger) {
      //   for (const point of this.points.current) {
      //     point.delete();
      //   }

      //   // this.#selectionBrush.add(Visibility.Hidden);
      // }
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
