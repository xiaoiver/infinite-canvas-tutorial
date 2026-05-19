import type { Rect } from './math';
import { RainDrop } from './raindrop';
import { randomInRect, randomRange } from './random';
import type { RaindropSimulator, SimulatorOptions } from './simulator';
import type { Vec2 } from './math';

export class Spawner {
  currentTime = 0;
  nextSpawn = 0;
  private readonly simulator: RaindropSimulator;

  constructor(simulator: RaindropSimulator, _options: SimulatorOptions) {
    this.simulator = simulator;
  }

  get interval() {
    return this.simulator.options.spawnInterval;
  }

  get size() {
    return this.simulator.options.spawnSize;
  }

  get spawnRect(): Rect {
    return this.simulator.options.viewport;
  }

  update(dt: number): this {
    this.currentTime += dt;
    return this;
  }

  *trySpawn(): Iterable<RainDrop> {
    while (this.currentTime >= this.nextSpawn) {
      const size = randomRange(...this.size);
      const pos = randomInRect(this.spawnRect);
      this.nextSpawn += randomRange(...this.interval);
      yield new RainDrop(this.simulator, pos, size);
    }
  }

  spawn(pos: Vec2, size: number, density = 1): RainDrop {
    return new RainDrop(this.simulator, pos, size, density);
  }
}
