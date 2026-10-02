import {
  Camera,
  CameraControl,
  Canvas,
  ComputeBounds,
  ComputeCamera,
  EventWriter,
  Edit,
  Plugin,
  PreStartUp,
  PostStartUp,
  PropagateTransforms,
  SyncSimpleTransforms,
  system,
  Last,
} from '@infinite-canvas-tutorial/ecs';
import {
  Comment,
  DownloadAnimationExport,
  DownloadScreenshot,
  EmitCanvasReady,
  InitCanvas,
  ListenTransformableStatus,
  ZoomLevel,
} from '../systems';

export const UIPlugin: Plugin = () => {
  /**
   * Solve the following error:
   * Uncaught (in promise) p: Multiple component types named o; names must be unique at eG.createSystems
   *
   * Usually, this error is caused when the code is bundled.
   */
  Object.defineProperty(InitCanvas, 'name', {
    value: 'InitCanvas',
  });
  Object.defineProperty(ZoomLevel, 'name', {
    value: 'ZoomLevel',
  });
  Object.defineProperty(DownloadScreenshot, 'name', {
    value: 'DownloadScreenshot',
  });
  Object.defineProperty(DownloadAnimationExport, 'name', {
    value: 'DownloadAnimationExport',
  });
  Object.defineProperty(ListenTransformableStatus, 'name', {
    value: 'ListenTransformableStatus',
  });
  Object.defineProperty(Comment, 'name', {
    value: 'Comment',
  });
  Object.defineProperty(EmitCanvasReady, 'name', {
    value: 'EmitCanvasReady',
  });

  // Initialization and synchronous READY handlers use broad API permissions.
  // Explicit phases keep them ahead of edits and derived data without inferred
  // dependencies moving them behind the components they initialize.
  system(PreStartUp)(InitCanvas);
  system((s) =>
    s.inAnyOrderWith(s.allSystems).after(PreStartUp).before(ZoomLevel),
  )(InitCanvas);
  system(PostStartUp)(EmitCanvasReady);
  system((s) => s.inAnyOrderWith(s.allSystems).before(ZoomLevel))(
    EmitCanvasReady,
  );
  // React to ComputedCamera changes only — must not run after Select (that caused
  // Select → ZoomLevel → ComputeCamera → Select precedence cycles).
  system((s) =>
    s
      .inAnyOrderWithWritersOf(Camera)
      .afterWritersOf(Canvas)
      .after(
        Edit,
        SyncSimpleTransforms,
        PropagateTransforms,
        ComputeBounds,
        CameraControl,
        ComputeCamera,
      )
      .before(Last),
  )(ZoomLevel);
  // Consume outputs from the preceding frame before the next frame begins.
  system((s) => s.inAnyOrderWith(s.allSystems).before(PreStartUp))(
    DownloadAnimationExport,
  );
  system((s) => s.inAnyOrderWith(s.allSystems).before(PreStartUp))(
    DownloadScreenshot,
  );
  system(PreStartUp)(ListenTransformableStatus);
  system((s) => s.inAnyOrderWith(s.allSystems))(ListenTransformableStatus);
  // Comments need this frame's input and camera coordinates.
  system((s) =>
    s
      .inAnyOrderWith(s.allSystems)
      .after(EventWriter, CameraControl, ComputeCamera)
      .before(Last),
  )(Comment);
};
