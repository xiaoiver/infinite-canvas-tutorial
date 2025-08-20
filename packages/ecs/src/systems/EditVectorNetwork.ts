import { Entity, System } from '@lastolivegames/becsy';
import { Commands } from '../commands';
import {
  Camera,
  Canvas,
  Children,
  Circle,
  ComputedBounds,
  ComputedCamera,
  Cursor,
  Ellipse,
  FillSolid,
  GlobalTransform,
  Highlighted,
  Input,
  InputPoint,
  OBB,
  Opacity,
  Parent,
  Path,
  Pen,
  Polyline,
  Rect,
  Renderable,
  Selected,
  Stroke,
  StrokeAttenuation,
  Text,
  Transform,
  Transformable,
  UI,
  UIType,
  Visibility,
  ZIndex,
  VectorNetwork,
  Name,
  SizeAttenuation,
  Anchor,
} from '../components';
import { safeAddComponent } from '../history';
import {
  AnchorName,
  API,
  Mat3,
  ToBeDeleted,
  TRANSFORMER_ANCHOR_FILL_COLOR,
  TRANSFORMER_ANCHOR_RESIZE_RADIUS,
  TRANSFORMER_ANCHOR_STROKE_COLOR,
  TRANSFORMER_Z_INDEX,
  updateGlobalTransform,
} from '..';
import { vec2 } from 'gl-matrix';

export class EditVectorNetwork extends System {
  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private readonly vectorNetworks = this.query(
    (q) => q.current.with(VectorNetwork).write,
  );

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Canvas, ComputedBounds, ComputedCamera)
          .read.update.and.using(
            GlobalTransform,
            InputPoint,
            Input,
            Cursor,
            Camera,
            UI,
            Selected,
            Highlighted,
            Transform,
            Parent,
            Children,
            Renderable,
            FillSolid,
            Opacity,
            Stroke,
            Rect,
            Circle,
            Ellipse,
            Text,
            Path,
            Polyline,
            Visibility,
            ZIndex,
            StrokeAttenuation,
            Transformable,
          ).write,
    );
  }

  execute() {
    this.cameras.current.forEach((camera) => {
      if (!camera.has(Camera)) {
        return;
      }

      const { canvas } = camera.read(Camera);
      if (!canvas) {
        return;
      }

      const { inputPoints, api } = canvas.read(Canvas);
      const pen = api.getAppState().penbarSelected;

      if (pen !== Pen.VECTOR_NETWORK) {
        // vector network -> path
        return;
      }

      this.createOrUpdate(camera);
    });
  }

  private createOrUpdate(camera: Entity) {
    const { selecteds } = camera.read(Transformable);
    const selected = selecteds[0];

    const transformable = camera.read(Transformable);
    const { vertices, segments } = selected.read(VectorNetwork);

    const toCreateAnchorNumber =
      vertices.length - transformable.controlPoints.length;
    if (toCreateAnchorNumber > 0) {
      for (let i = 0; i < toCreateAnchorNumber; i++) {
        const anchor = this.createAnchor(
          camera,
          vertices[i].x,
          vertices[i].y,
          AnchorName.CONTROL,
        );
        this.commands.entity(camera).appendChild(this.commands.entity(anchor));
      }
      this.commands.execute();
    } else {
      // Remove redundant control points
      for (let i = 0; i < Math.abs(toCreateAnchorNumber); i++) {
        const anchor = transformable.controlPoints.pop();
        if (anchor) {
          anchor.add(ToBeDeleted);
        }
      }
    }

    const matrix = Mat3.toGLMat3(selected.read(GlobalTransform).matrix);
    transformable.controlPoints.forEach((controlPoint, i) => {
      const { x, y } = vertices[i];
      const transformed = vec2.transformMat3(vec2.create(), [x, y], matrix);
      Object.assign(controlPoint.write(Circle), {
        cx: transformed[0],
        cy: transformed[1],
      });
      controlPoint.write(Visibility).value = 'visible';
      updateGlobalTransform(controlPoint);
    });
  }

  private createAnchor(camera: Entity, cx: number, cy: number, name: string) {
    const anchor = this.commands
      .spawn(
        new UI(UIType.TRANSFORMER_ANCHOR),
        new Name(name),
        new Transform(),
        new Renderable(),
        new FillSolid(TRANSFORMER_ANCHOR_FILL_COLOR),
        new Stroke({ width: 1, color: TRANSFORMER_ANCHOR_STROKE_COLOR }),
        new Circle({
          cx,
          cy,
          r: TRANSFORMER_ANCHOR_RESIZE_RADIUS,
        }),
        new SizeAttenuation(),
        new Visibility(),
      )
      .id()
      .hold();

    if (name === AnchorName.CONTROL) {
      anchor.add(Anchor, { camera });
      anchor.add(ZIndex, { value: TRANSFORMER_Z_INDEX });
    }

    return anchor;
  }

  // private handleSelectedMovingControlPoint(
  //   api: API,
  //   sx: number,
  //   sy: number,
  //   ex: number,
  //   ey: number,
  // ) {
  //   const camera = api.getCamera();
  //   camera.write(Transformable).status = TransformableStatus.MOVING;

  //   const { selecteds } = camera.read(Transformable);
  //   const { activeControlPointIndex } = camera.read(SelectVectorNetwork);
  //   selecteds.forEach((selected) => {
  //     const vn = selected.write(VectorNetwork);
  //     const { vertices } = vn;
  //     vertices[activeControlPointIndex].x = ex;
  //     vertices[activeControlPointIndex].y = ey;

  //     const node = api.getNodeByEntity(selected);
  //     api.updateNode(VectorNetwork.toSerializedNode(vn, node));
  //   });

  //   // this.renderTransformer.createOrUpdate(camera);
  // }

  // private handleSelectedMovedControlPoint(
  //   api: API,
  //   selection: SelectVectorNetwork,
  // ) {
  //   const camera = api.getCamera();

  //   api.setNodes(api.getNodes());
  //   api.record();

  //   const { selecteds } = camera.read(Transformable);
  //   selecteds.forEach((selected) => {});

  //   camera.write(Transformable).status = TransformableStatus.MOVED;
  // }
}
