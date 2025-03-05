import {
  toMatchSVGSnapshot,
  ToMatchSVGSnapshotOptions,
} from './toMatchSVGSnapshot';
import {
  toMatchWebGLSnapshot,
  ToMatchWebGLSnapshotOptions,
} from './toMatchWebGLSnapshot';

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchWebGLSnapshot(
        dir: string,
        name: string,
        options?: ToMatchWebGLSnapshotOptions,
      ): Promise<R>;
      toMatchSVGSnapshot(
        dir: string,
        name: string,
        options?: ToMatchSVGSnapshotOptions,
      ): R;
    }
  }
}

expect.extend({
  toMatchSVGSnapshot,
  toMatchWebGLSnapshot,
});
