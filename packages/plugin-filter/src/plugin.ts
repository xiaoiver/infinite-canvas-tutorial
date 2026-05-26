import {
  Plugin,
  system,
  registerFilterBackend,
  MeshPipeline,
} from '@infinite-canvas-tutorial/ecs';
import { createFilterBackend } from './backend';
import { PostEffectTime } from './PostEffectTime';

export const FilterPlugin: Plugin = () => {
  registerFilterBackend(createFilterBackend());
  system((s) => s.before(MeshPipeline))(PostEffectTime);
};

export { createFilterBackend } from './backend';
