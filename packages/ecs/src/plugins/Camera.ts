import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  Camera,
  ComputedCamera,
  ComputedCameraControl,
  RBush,
} from '../components';
import {
  CameraControl,
  ComputeBounds,
  ComputeCamera,
  ComputeVisibility,
  EventWriter,
  PropagateTransforms,
  SetupDevice,
  SyncSimpleTransforms,
} from '../systems';

export const CameraPlugin: Plugin = () => {
  component(Camera);
  component(ComputedCamera);
  component(ComputedCameraControl);
  component(RBush);

  system((s) =>
    s.after(
      EventWriter,
      SetupDevice,
      SyncSimpleTransforms,
      PropagateTransforms,
      ComputeVisibility,
      ComputeBounds,
      ComputeCamera,
    ),
  )(CameraControl);
  system((s) => s.afterWritersOf(Camera))(ComputeCamera);
};
