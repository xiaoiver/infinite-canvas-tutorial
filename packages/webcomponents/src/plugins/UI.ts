import {
  Camera,
  CameraControl,
  Canvas,
  ComputeBounds,
  ComputeCamera,
  Plugin,
  PreStartUp,
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

  system((s) => s.after(PreStartUp).before(ZoomLevel).beforeWritersOf(Canvas))(
    InitCanvas,
  );
  system((s) => s.after(PreStartUp, InitCanvas).before(ZoomLevel).beforeWritersOf(Canvas))(
    EmitCanvasReady,
  );
  // React to ComputedCamera changes only — must not run after Select (that caused
  // Select → ZoomLevel → ComputeCamera → Select precedence cycles).
  system((s) =>
    s
      .inAnyOrderWithWritersOf(Camera)
      .afterWritersOf(Canvas)
      .after(
        SyncSimpleTransforms,
        PropagateTransforms,
        ComputeBounds,
        CameraControl,
        ComputeCamera,
      )
      .before(Last),
  )(ZoomLevel);
  system((s) => s.before(PreStartUp))(DownloadAnimationExport);
  system((s) => s.before(PreStartUp))(DownloadScreenshot);
  system(PreStartUp)(ListenTransformableStatus);
  system(PreStartUp)(Comment);
};
