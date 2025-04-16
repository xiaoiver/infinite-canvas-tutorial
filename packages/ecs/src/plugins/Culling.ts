import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { ComputeCamera, PostUpdate, ViewportCulling } from '../systems';
import { ComputedBounds, Culled } from '../components';

export const CullingPlugin: Plugin = () => {
  component(Culled);

  system(PostUpdate)(ViewportCulling);
  system((s) => s.afterWritersOf(ComputedBounds).after(ComputeCamera))(
    ViewportCulling,
  );
};
