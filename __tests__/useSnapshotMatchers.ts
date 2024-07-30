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
    }
  }
}

expect.extend({
  toMatchWebGLSnapshot,
});
