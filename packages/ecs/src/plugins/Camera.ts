import { Plugin } from '.';
import { Camera, ComputedCamera } from '../components';
import { CameraControl, ComputeCamera } from '../systems';

export const CameraPlugin: Plugin = () => {
  return [Camera, ComputedCamera, CameraControl, ComputeCamera];
};
