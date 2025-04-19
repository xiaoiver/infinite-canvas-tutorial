import { Entity, System } from '@lastolivegames/becsy';
import {
  Children,
  Circle,
  ComputedBounds,
  FillSolid,
  Opacity,
  Parent,
  Rect,
  Renderable,
  Selected,
  SizeAttenuation,
  Stroke,
  StrokeAttenuation,
  ToBeDeleted,
  Transform,
  UI,
  ZIndex,
} from '../components';
import { Commands } from '../commands';
import { getDescendants, getSceneRoot } from './Transform';

/**
 * @see https://github.com/konvajs/konva/blob/master/src/shapes/Transformer.ts
 */
export class RenderTransformer extends System {
  private readonly commands = new Commands(this);

  private readonly selected = this.query((q) =>
    q.added.and.removed.with(Selected),
  );

  #transformers = new WeakMap<Entity, Entity>();

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(ComputedBounds)
          .read.and.using(
            UI,
            Selected,
            Transform,
            Parent,
            Children,
            Renderable,
            FillSolid,
            Opacity,
            Stroke,
            Rect,
            Circle,
            ZIndex,
            SizeAttenuation,
            StrokeAttenuation,
            ToBeDeleted,
          ).write,
    );
  }

  execute() {
    this.selected.added.forEach((entity) => {
      console.log('add', entity);

      const { geometryBounds } = entity.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;
      const width = maxX - minX;
      const height = maxY - minY;
      const { rotation } = entity.read(Transform);

      const transformer = this.commands
        .spawn(
          new UI(),
          new Transform({
            rotation,
          }),
          new Renderable(),
          new FillSolid('white'), // --spectrum-blue-100
          new Opacity({ fillOpacity: 0 }),
          new Stroke({ width: 1, color: '#147af3' }), // --spectrum-thumbnail-border-color-selected
          new Rect({
            x: minX,
            y: minY,
            width,
            height,
          }),
          new ZIndex(Infinity),
          new StrokeAttenuation(),
        )
        .id()
        .hold();

      const tlAnchor = this.createAnchor(minX, minY);
      const trAnchor = this.createAnchor(maxX, minY);
      const blAnchor = this.createAnchor(minX, maxY);
      const brAnchor = this.createAnchor(maxX, maxY);

      const transformEntity = this.commands.entity(transformer);
      transformEntity.appendChild(this.commands.entity(tlAnchor));
      transformEntity.appendChild(this.commands.entity(trAnchor));
      transformEntity.appendChild(this.commands.entity(blAnchor));
      transformEntity.appendChild(this.commands.entity(brAnchor));

      this.commands.execute();

      const camera = this.commands.entity(getSceneRoot(entity));
      camera.appendChild(this.commands.entity(transformer));

      this.commands.execute();

      this.#transformers.set(entity, transformer);
    });

    this.selected.removed.forEach((entity) => {
      console.log('remove', entity);

      if (this.#transformers.has(entity)) {
        const transformer = this.#transformers.get(entity);

        transformer.add(ToBeDeleted);
        getDescendants(transformer).forEach((child) => {
          child.add(ToBeDeleted);
        });

        this.#transformers.delete(entity);
      }
    });
  }

  private createAnchor(cx: number, cy: number) {
    return this.commands
      .spawn(
        new UI(),
        new Transform(),
        new Renderable(),
        new FillSolid('#fff'),
        new Stroke({ width: 1, color: '#147af3' }),
        new Circle({
          cx,
          cy,
          r: 5,
        }),
        new SizeAttenuation(),
      )
      .id()
      .hold();
  }
}
