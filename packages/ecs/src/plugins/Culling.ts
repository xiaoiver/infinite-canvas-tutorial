import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { ComputeCamera, ComputeLOD, Last, ViewportCulling } from '../systems';
import {
  ComputedBounds,
  ComputedLOD,
  Culled,
  Selected,
  Highlighted,
  Editable,
} from '../components';

export const CullingPlugin: Plugin = () => {
  component(Culled);
  component(ComputedLOD);

  // Same schedule region as CameraSync / Pick3D (after ComputeCamera, not PostUpdate).
  system((s) =>
    s.afterWritersOf(ComputedBounds).after(ComputeCamera).before(Last),
  )(ViewportCulling);
  system((s) =>
    s
      .after(ViewportCulling)
      .afterWritersOf(Selected, Highlighted, Editable)
      .before(Last),
  )(ComputeLOD);
};
