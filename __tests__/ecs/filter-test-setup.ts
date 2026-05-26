import { registerFilterBackend } from '../../packages/ecs/src/filter';
import { createFilterBackend } from '../../packages/plugin-filter/src/plugin';

beforeAll(() => {
  registerFilterBackend(createFilterBackend());
});
