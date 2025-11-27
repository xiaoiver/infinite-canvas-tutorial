import {
  Camera,
  CameraControl,
  Canvas,
  ComputeBounds,
  Plugin,
  PreStartUp,
  PropagateTransforms,
  SetupDevice,
  SyncSimpleTransforms,
  system,
  Select,
  Last,
  RenderTransformer,
  RenderHighlighter,
  RenderSnap,
} from '@infinite-canvas-tutorial/ecs';
import {
  Comment,
  DownloadScreenshot,
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
  Object.defineProperty(ListenTransformableStatus, 'name', {
    value: 'ListenTransformableStatus',
  });
  Object.defineProperty(Comment, 'name', {
    value: 'Comment',
  });

  system((s) => s.after(PreStartUp).before(ZoomLevel).beforeWritersOf(Canvas))(
    InitCanvas,
  );
  system((s) =>
    s
      .inAnyOrderWithWritersOf(Camera)
      .after(
        SetupDevice,
        SyncSimpleTransforms,
        PropagateTransforms,
        ComputeBounds,
        CameraControl,
        Select,
        RenderTransformer,
        RenderHighlighter,
        RenderSnap,
      )
      .before(Last),
  )(ZoomLevel);
  system((s) => s.before(PreStartUp))(DownloadScreenshot);
  system(PreStartUp)(ListenTransformableStatus);
  system(PreStartUp)(Comment);
};
