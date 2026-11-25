import {
  type Entity,
  Name,
  RenderNameLabel,
} from '@infinite-canvas-tutorial/ecs';

/** Count actual Name reads inside the real system, restoring both observers. */
export async function sampleNameLabelReads(
  entity: Entity,
  frames: () => Promise<void>,
) {
  const execute = RenderNameLabel.prototype.execute;
  const prototype = Object.getPrototypeOf(entity) as Entity;
  const read = prototype.read;
  let active = false,
    executions = 0,
    reads = 0;
  RenderNameLabel.prototype.execute = function () {
    executions++;
    active = true;
    try {
      return execute.call(this);
    } finally {
      active = false;
    }
  };
  prototype.read = function (...args: Parameters<typeof read>) {
    if (active && args[0] === Name) reads++;
    return read.apply(this, args);
  } as typeof read;
  try {
    await frames();
    return { executions, reads };
  } finally {
    prototype.read = read;
    RenderNameLabel.prototype.execute = execute;
  }
}
