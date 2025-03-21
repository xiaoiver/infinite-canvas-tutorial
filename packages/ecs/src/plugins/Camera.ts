import { Plugin } from './types';
import { Camera, ComputedCamera, ComputedCameraControl } from '../components';
import { CameraControl, ComputeCamera } from '../systems';

export const CameraPlugin: Plugin = () => {
  return [
    Camera,
    ComputedCamera,
    ComputedCameraControl,
    CameraControl,
    ComputeCamera,
  ];
};
