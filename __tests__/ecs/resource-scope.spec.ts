import { ResourceScope } from '../../packages/ecs/src/resources/ResourceScope';

describe('GPU resource ownership', () => {
  it('releases dependants first and supports early, idempotent cleanup', () => {
    const scope = new ResourceScope();
    const calls: string[] = [];
    scope.add(() => calls.push('device'));
    scope.add(() => calls.push('cache'));
    const releaseExport = scope.add(() => calls.push('export'));
    scope.add(() => calls.push('renderer'));
    releaseExport();
    releaseExport();
    scope.dispose();
    scope.dispose();
    expect(calls).toEqual(['export', 'renderer', 'cache', 'device']);
  });

  it('cleans up late asynchronous resources immediately after disposal', () => {
    const scope = new ResourceScope();
    scope.dispose();
    const release = jest.fn();
    scope.add(release)();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('still releases other resources when one cleanup fails', () => {
    const scope = new ResourceScope();
    const releaseDevice = jest.fn();
    scope.add(releaseDevice);
    scope.add(() => {
      throw new Error('renderer failed');
    });
    expect(() => scope.dispose()).toThrow('Resource cleanup failed');
    expect(releaseDevice).toHaveBeenCalledTimes(1);
  });
});
