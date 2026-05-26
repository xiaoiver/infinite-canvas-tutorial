/**
 * Ported from raindrop-fx (MIT, SardineFish).
 */
import { Rect, Vec2 } from './math';
import { RainDrop } from './raindrop';
import { Spawner } from './spawner';
import type { Time } from './utils';

export interface SimulatorOptions {
  viewport: Rect;
  spawnInterval: [number, number];
  spawnSize: [number, number];
  spawnLimit: number;
  slipRate: number;
  motionInterval: [number, number];
  xShifting: [number, number];
  colliderSize: number;
  trailDropDensity: number;
  trailDropSize: [number, number];
  trailDistance: [number, number];
  trailSpread: number;
  initialSpread: number;
  shrinkRate: number;
  velocitySpread: number;
  evaporate: number;
  gravity: number;
}

export class CollisionGrid extends Array<RainDrop> {
  add(raindrop: RainDrop): void {
    const len = super.push(raindrop);
    raindrop.gridIdx = len - 1;
    raindrop.grid = this;
  }

  delete(raindrop: RainDrop): void {
    const idx = raindrop.gridIdx as number;
    this[idx] = this[this.length - 1]!;
    this[idx]!.gridIdx = idx;
    this.length--;
    raindrop.gridIdx = -1;
    raindrop.grid = undefined;
  }
}

export class RaindropSimulator {
  options: SimulatorOptions;
  spawner: Spawner;
  raindrops: RainDrop[] = [];
  grid: CollisionGrid[] = [];

  constructor(options: SimulatorOptions) {
    this.options = options;
    this.spawner = new Spawner(this, options);
    this.resize();
  }

  get gridSize(): number {
    return this.options.spawnSize[1] * 0.3;
  }

  resize(): void {
    const w = Math.ceil(this.options.viewport.size.x / this.gridSize);
    const h = Math.ceil(this.options.viewport.size.y / this.gridSize);
    let base = 0;
    if (this.grid.length < w * h) {
      base = this.grid.length;
      this.grid.length = w * h;
    }
    for (let i = base; i < this.grid.length; i++) {
      this.grid[i] = new CollisionGrid();
    }
  }

  gridAt(gridX: number, gridY: number): CollisionGrid | undefined {
    if (gridX < 0 || gridY < 0) {
      return undefined;
    }
    const gridWidth = Math.ceil(
      (this.options.viewport.xMax - this.options.viewport.xMin) / this.gridSize,
    );
    const idx = gridY * gridWidth + gridX;
    if (idx >= this.grid.length) {
      return undefined;
    }
    return this.grid[idx];
  }

  gridAtWorldPos(x: number, y: number): CollisionGrid | undefined {
    return this.gridAt(...this.worldToGrid(x, y));
  }

  worldToGrid(x: number, y: number): [number, number] {
    const gridX = Math.floor(x / this.gridSize);
    const gridY = Math.floor(y / this.gridSize);
    return [gridX, gridY];
  }

  add(raindrop: RainDrop): void {
    this.raindrops.push(raindrop);
    const grid = this.gridAtWorldPos(raindrop.pos.x, raindrop.pos.y);
    if (grid) {
      grid.add(raindrop);
    }
  }

  update(time: Time): void {
    if (this.raindrops.length <= this.options.spawnLimit) {
      for (const newDrop of this.spawner.update(time.dt).trySpawn()) {
        this.raindrops.push(newDrop);
      }
    }

    this.raindropUpdate(time);
    this.collisionUpdate();

    for (let i = 0; i < this.raindrops.length; i++) {
      if (this.raindrops[i]!.destroied) {
        this.raindrops[i]!.grid?.delete(this.raindrops[i]!);
        this.raindrops[i] = this.raindrops[this.raindrops.length - 1]!;
        this.raindrops.length--;
      }
    }
  }

  raindropUpdate(time: Time): void {
    for (let i = 0; i < this.raindrops.length; i++) {
      const raindrop = this.raindrops[i]!;
      if (raindrop.destroied) {
        continue;
      }

      raindrop.updateRaindrop(time);
      if (raindrop.pos.y < -100) {
        raindrop.destroied = true;
      }

      if (raindrop.destroied) {
        continue;
      }

      const [gridX, gridY] = this.worldToGrid(raindrop.pos.x, raindrop.pos.y);
      const grid = this.gridAt(gridX, gridY);
      if (grid !== raindrop.grid) {
        raindrop.grid?.delete(raindrop);
        grid?.add(raindrop);
        raindrop.grid = grid;
      }
    }
  }

  collisionUpdate(): void {
    for (let i = 0; i < this.raindrops.length; i++) {
      const raindrop = this.raindrops[i]!;
      if (raindrop.destroied) {
        continue;
      }

      const [gridX, gridY] = this.worldToGrid(raindrop.pos.x, raindrop.pos.y);

      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          const grid = this.gridAt(gridX + x, gridY + y);
          if (!grid) {
            continue;
          }

          for (const other of grid) {
            const isSame = other === raindrop;
            const isParent =
              other.parent === raindrop || raindrop.parent === other;
            const isAdjacent =
              raindrop.parent != null && raindrop.parent === other.parent;
            if (other.destroied || isParent || isAdjacent || isSame) {
              continue;
            }

            const dx = raindrop.pos.x - other.pos.x;
            const dy = raindrop.pos.y - other.pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (
              distance - raindrop.mergeDistance - other.mergeDistance <
              0
            ) {
              if (raindrop.mass >= other.mass) {
                raindrop.merge(other);
                other.destroied = true;
              } else {
                other.merge(raindrop);
                raindrop.destroied = true;
              }
            }
          }
        }
      }
    }
  }
}
