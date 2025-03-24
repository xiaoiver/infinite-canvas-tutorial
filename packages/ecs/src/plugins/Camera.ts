import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { Camera, ComputedCamera, ComputedCameraControl } from '../components';
import {
  CameraControl,
  ComputeCamera,
  EventWriter,
  SetupDevice,
} from '../systems';

export const CameraPlugin: Plugin = () => {
  component(Camera);
  component(ComputedCamera);
  component(ComputedCameraControl);

  system((s) => s.afterWritersOf(Camera).after(EventWriter, SetupDevice))(
    CameraControl,
  );
  system((s) => s.afterWritersOf(Camera))(ComputeCamera);
};
