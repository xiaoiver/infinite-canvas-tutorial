import { registerFilterBackend } from '../../packages/ecs/src/filter';
import { createFilterBackend } from '../../packages/plugin-filter/src/backend';

beforeAll(() => {
  registerFilterBackend(createFilterBackend());
});
