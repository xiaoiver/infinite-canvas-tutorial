import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { ComputeCamera, Last, ViewportCulling } from '../systems';
import { ComputedBounds, Culled } from '../components';

export const CullingPlugin: Plugin = () => {
  component(Culled);

  // Same schedule region as CameraSync / Pick3D (after ComputeCamera, not PostUpdate).
  system((s) =>
    s.afterWritersOf(ComputedBounds).after(ComputeCamera).before(Last),
  )(ViewportCulling);
};
