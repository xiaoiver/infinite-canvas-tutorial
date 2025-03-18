import { component, system } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from '.';
import { Camera, ComputedCamera } from '../components';
import { CameraControl, ComputeCamera } from '../systems';

export const CameraPlugin: Plugin = (app: App) => {
  component(Camera);
  component(ComputedCamera);

  system((s) => s.afterWritersOf(Camera))(ComputeCamera);
  system((s) => s.after(ComputeCamera))(CameraControl);
};
