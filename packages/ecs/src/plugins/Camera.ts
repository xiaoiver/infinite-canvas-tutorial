import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  Camera,
  ComputedCamera,
  ComputedCameraControl,
  RBush,
  Transformable,
} from '../components';
import {
  CameraControl,
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
  component(Transformable);

  system((s) =>
    s
      .afterWritersOf(Camera)
      .after(
        EventWriter,
        SetupDevice,
        SyncSimpleTransforms,
        PropagateTransforms,
        ComputeVisibility,
      ),
  )(CameraControl);
  system((s) => s.afterWritersOf(Camera).after(CameraControl))(ComputeCamera);
};
