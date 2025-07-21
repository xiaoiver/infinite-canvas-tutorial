import { System } from '@lastolivegames/becsy';
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
} from '../components';
import { safeAddComponent } from '../history';
import { API } from '..';

export class EditVectorNetwork extends System {
  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);

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
      const pen = api.getAppState().penbarSelected[0];

      if (pen !== Pen.VECTOR_NETWORK) {
        return;
      }
    });
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
