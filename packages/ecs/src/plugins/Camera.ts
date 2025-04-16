import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { Camera, ComputedCamera, ComputedCameraControl } from '../components';
import {
  CameraControl,
  ComputeCamera,
  EventWriter,
  PropagateTransforms,
  SetupDevice,
  SyncSimpleTransforms,
} from '../systems';

export const CameraPlugin: Plugin = () => {
  component(Camera);
  component(ComputedCamera);
  component(ComputedCameraControl);

  system((s) =>
    s
      .afterWritersOf(Camera)
      .after(
        EventWriter,
        SetupDevice,
        SyncSimpleTransforms,
        PropagateTransforms,
      ),
  )(CameraControl);
  system((s) => s.afterWritersOf(Camera).after(CameraControl))(ComputeCamera);
};
