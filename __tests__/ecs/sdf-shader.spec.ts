import { readFileSync } from 'fs';
import { join } from 'path';

const shaderPaths = [
  'packages/core/src/shaders/sdf.ts',
  'packages/ecs/src/shaders/sdf.ts',
  'packages/lesson_009/src/shaders/sdf.ts',
  'packages/lesson_010/src/shaders/sdf.ts',
  'packages/lesson_012/src/shaders/sdf.ts',
  'packages/lesson_013/src/shaders/sdf.ts',
];

describe('SDF shader antialiasing', () => {
  it.each(shaderPaths)(
    '%s uses the signed distance derivative for shape edges',
    (shaderPath) => {
      const source = readFileSync(join(__dirname, '../..', shaderPath), 'utf8');

      expect(source).toContain('float antialiasedBlur = -fwidth(distance);');
      expect(source).not.toContain('fwidth(length(v_FragCoord))');
    },
  );
});
