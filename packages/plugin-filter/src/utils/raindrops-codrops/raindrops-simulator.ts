/**
 * Port of Codrops {@link https://github.com/codrops/RainEffect/blob/master/src/raindrops.js raindrops.js}
 * (Canvas2D liquid map for {@link https://github.com/codrops/RainEffect/blob/master/src/shaders/water.frag water.frag}).
 * Call {@link RaindropsCodropsSimulator.update} each frame with `timeScale` (same semantics as original `deltaT / (1000/60)`).
 */
import { DOMAdapter } from '@infinite-canvas-tutorial/ecs';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Any2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const DROP_SPRITE_PX = 64;

function rnd(min: number, max: number, skew?: (u: number) => number): number {
  let u = Math.random();
  if (skew) {
    u = skew(u);
  }
  return min + (max - min) * u;
}

function chance(p: number): boolean {
  return Math.random() < p;
}

export const RAINDROPS_CODROPS_DEFAULT_OPTIONS = {
  minR: 10,
  maxR: 40,
  maxDrops: 900,
  rainChance: 0.3,
  rainLimit: 3,
  dropletsRate: 50,
  dropletsSize: [2, 4] as [number, number],
  dropletsCleaningRadiusMultiplier: 0.43,
  raining: true,
  globalTimeScale: 1,
  trailRate: 1,
  autoShrink: true,
  spawnArea: [-0.1, 0.95] as [number, number],
  trailScaleRange: [0.2, 0.5] as [number, number],
  collisionRadius: 0.65,
  collisionRadiusIncrease: 0.01,
  dropFallMultiplier: 1,
  collisionBoostMultiplier: 0.05,
  collisionBoost: 1,
} as const;

/** Mutable options (defaults stay `as const`; runtime values are plain numbers). */
export type RaindropsCodropsOptions = {
  [K in keyof typeof RAINDROPS_CODROPS_DEFAULT_OPTIONS]: (typeof RAINDROPS_CODROPS_DEFAULT_OPTIONS)[K] extends readonly [
    number,
    number,
  ]
    ? [number, number]
    : (typeof RAINDROPS_CODROPS_DEFAULT_OPTIONS)[K] extends number
      ? number
      : (typeof RAINDROPS_CODROPS_DEFAULT_OPTIONS)[K];
};

interface DropState {
  x: number;
  y: number;
  r: number;
  spreadX: number;
  spreadY: number;
  momentum: number;
  momentumX: number;
  lastSpawn: number;
  nextSpawn: number;
  parent: DropState | null;
  isNew: boolean;
  killed: boolean;
  shrink: number;
}

function createDropState(p: Partial<DropState> & Pick<DropState, 'x' | 'y' | 'r'>): DropState {
  return {
    spreadX: 0,
    spreadY: 0,
    momentum: 0,
    momentumX: 0,
    lastSpawn: 0,
    nextSpawn: 0,
    parent: null,
    isNew: true,
    killed: false,
    shrink: 0,
    ...p,
  };
}

export class RaindropsCodropsSimulator {
  readonly canvas: AnyCanvas;
  private readonly ctx: Any2D;
  private readonly dropletsCanvas: AnyCanvas;
  private readonly dropletsCtx: Any2D;
  private readonly width: number;
  private readonly height: number;
  private readonly scale: number;
  private readonly options: RaindropsCodropsOptions;
  private dropsGfx: AnyCanvas[] = [];
  private clearDropletsGfx: AnyCanvas;
  private drops: DropState[] = [];
  private dropletsCounter = 0;
  private textureCleaningIterations = 0;
  private readonly dropletsPixelDensity = 1;

  constructor(
    width: number,
    height: number,
    scale: number,
    dropColor: CanvasImageSource,
    dropAlpha: CanvasImageSource,
    options?: Partial<RaindropsCodropsOptions>,
  ) {
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.options = { ...RAINDROPS_CODROPS_DEFAULT_OPTIONS, ...options };
    const adapter = DOMAdapter.get();
    this.canvas = adapter.createCanvas(width, height);
    this.ctx = this.canvas.getContext('2d') as Any2D;
    this.dropletsCanvas = adapter.createCanvas(
      width * this.dropletsPixelDensity,
      height * this.dropletsPixelDensity,
    );
    this.dropletsCtx = this.dropletsCanvas.getContext(
      '2d',
    ) as Any2D;
    this.renderDropsGfx(dropColor, dropAlpha);
    this.clearDropletsGfx = adapter.createCanvas(128, 128);
    const cctx = this.clearDropletsGfx.getContext('2d') as Any2D;
    cctx.fillStyle = '#000';
    cctx.beginPath();
    cctx.arc(64, 64, 64, 0, Math.PI * 2);
    cctx.fill();
  }

  private get deltaR(): number {
    return this.options.maxR - this.options.minR;
  }

  private get area(): number {
    return (this.width * this.height) / this.scale;
  }

  private get areaMultiplier(): number {
    return Math.sqrt(this.area / (1024 * 768));
  }

  private renderDropsGfx(
    dropColor: CanvasImageSource,
    dropAlpha: CanvasImageSource,
  ): void {
    const adapter = DOMAdapter.get();
    const dropBuffer = adapter.createCanvas(DROP_SPRITE_PX, DROP_SPRITE_PX);
    const dropBufferCtx = dropBuffer.getContext('2d') as Any2D;
    this.dropsGfx = Array.from({ length: 255 }, (_, i) => {
      const drop = adapter.createCanvas(DROP_SPRITE_PX, DROP_SPRITE_PX);
      const dropCtx = drop.getContext('2d') as Any2D;
      dropBufferCtx.clearRect(0, 0, DROP_SPRITE_PX, DROP_SPRITE_PX);
      dropBufferCtx.globalCompositeOperation = 'source-over';
      dropBufferCtx.drawImage(
        dropColor,
        0,
        0,
        DROP_SPRITE_PX,
        DROP_SPRITE_PX,
      );
      dropBufferCtx.globalCompositeOperation = 'screen';
      dropBufferCtx.fillStyle = `rgba(0,0,${i},1)`;
      dropBufferCtx.fillRect(0, 0, DROP_SPRITE_PX, DROP_SPRITE_PX);
      dropCtx.globalCompositeOperation = 'source-over';
      dropCtx.drawImage(dropAlpha, 0, 0, DROP_SPRITE_PX, DROP_SPRITE_PX);
      dropCtx.globalCompositeOperation = 'source-in';
      dropCtx.drawImage(dropBuffer, 0, 0, DROP_SPRITE_PX, DROP_SPRITE_PX);
      return drop;
    });
  }

  private drawDrop(ctx: Any2D, drop: DropState): void {
    if (this.dropsGfx.length === 0) {
      return;
    }
    const { x, y, r, spreadX, spreadY } = drop;
    const scaleX = 1;
    const scaleY = 1.5;
    let d = Math.max(
      0,
      Math.min(1, ((r - this.options.minR) / this.deltaR) * 0.9),
    );
    d *= 1 / ((drop.spreadX + drop.spreadY) * 0.5 + 1);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const di = Math.floor(d * (this.dropsGfx.length - 1));
    const gfx = this.dropsGfx[di]!;
    ctx.drawImage(
      gfx,
      (x - r * scaleX * (spreadX + 1)) * this.scale,
      (y - r * scaleY * (spreadY + 1)) * this.scale,
      r * 2 * scaleX * (spreadX + 1) * this.scale,
      r * 2 * scaleY * (spreadY + 1) * this.scale,
    );
  }

  private drawDroplet(x: number, y: number, r: number): void {
    this.drawDrop(
      this.dropletsCtx,
      createDropState({
        x: x * this.dropletsPixelDensity,
        y: y * this.dropletsPixelDensity,
        r: r * this.dropletsPixelDensity,
        spreadX: 0,
        spreadY: 0,
        momentum: 0,
        momentumX: 0,
        lastSpawn: 0,
        nextSpawn: 0,
        parent: null,
        isNew: false,
        killed: false,
        shrink: 0,
      }),
    );
  }

  clearDroplets(x: number, y: number, r = 30): void {
    const ctx = this.dropletsCtx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(
      this.clearDropletsGfx,
      (x - r) * this.dropletsPixelDensity * this.scale,
      (y - r) * this.dropletsPixelDensity * this.scale,
      r * 2 * this.dropletsPixelDensity * this.scale,
      r * 2 * this.dropletsPixelDensity * this.scale * 1.5,
    );
  }

  private createDrop(p: Partial<DropState> & Pick<DropState, 'x' | 'y' | 'r'>): DropState | null {
    if (this.drops.length >= this.options.maxDrops * this.areaMultiplier) {
      return null;
    }
    return createDropState(p);
  }

  private addDrop(drop: DropState | null): boolean {
    if (
      drop == null ||
      this.drops.length >= this.options.maxDrops * this.areaMultiplier
    ) {
      return false;
    }
    this.drops.push(drop);
    return true;
  }

  private updateRain(timeScale: number): DropState[] {
    const rainDrops: DropState[] = [];
    if (!this.options.raining) {
      return rainDrops;
    }
    const limit = this.options.rainLimit * timeScale * this.areaMultiplier;
    let count = 0;
    while (
      chance(this.options.rainChance * timeScale * this.areaMultiplier) &&
      count < limit
    ) {
      count++;
      const r = rnd(this.options.minR, this.options.maxR, (n) => n ** 3);
      const rainDrop = this.createDrop({
        x: rnd(0, this.width / this.scale),
        y: rnd(
          (this.height / this.scale) * this.options.spawnArea[0],
          (this.height / this.scale) * this.options.spawnArea[1],
        ),
        r,
        momentum: 1 + (r - this.options.minR) * 0.1 + rnd(0, 2),
        spreadX: 1.5,
        spreadY: 1.5,
      });
      if (rainDrop) {
        rainDrops.push(rainDrop);
      }
    }
    return rainDrops;
  }

  private updateDroplets(timeScale: number): void {
    if (this.textureCleaningIterations > 0) {
      this.textureCleaningIterations -= 1 * timeScale;
      this.dropletsCtx.globalCompositeOperation = 'destination-out';
      this.dropletsCtx.fillStyle = `rgba(0,0,0,${0.05 * timeScale})`;
      this.dropletsCtx.fillRect(
        0,
        0,
        this.width * this.dropletsPixelDensity,
        this.height * this.dropletsPixelDensity,
      );
    }
    if (this.options.raining) {
      this.dropletsCounter +=
        this.options.dropletsRate * timeScale * this.areaMultiplier;
      const n = Math.floor(this.dropletsCounter);
      this.dropletsCounter -= n;
      for (let i = 0; i < n; i++) {
        this.drawDroplet(
          rnd(0, this.width / this.scale),
          rnd(0, this.height / this.scale),
          rnd(
            this.options.dropletsSize[0],
            this.options.dropletsSize[1],
            (u) => u * u,
          ),
        );
      }
    }
    this.ctx.drawImage(this.dropletsCanvas, 0, 0, this.width, this.height);
  }

  /** One simulation step (Codrops `update` body minus rAF). */
  update(timeScale: number): void {
    timeScale *= this.options.globalTimeScale;
    this.ctx.clearRect(0, 0, this.width, this.height);
    const newDrops: DropState[] = [];
    this.updateDroplets(timeScale);
    const rainDrops = this.updateRain(timeScale);
    newDrops.push(...rainDrops);

    this.drops.sort((a, b) => {
      const va = a.y * (this.width / this.scale) + a.x;
      const vb = b.y * (this.width / this.scale) + b.x;
      return va > vb ? 1 : va === vb ? 0 : -1;
    });

    this.drops.forEach((drop, i) => {
      if (drop.killed) {
        return;
      }
      if (
        chance(
          ((drop.r - this.options.minR * this.options.dropFallMultiplier) *
            (0.1 / this.deltaR)) *
            timeScale,
        )
      ) {
        drop.momentum += rnd(0, (drop.r / this.options.maxR) * 4);
      }
      if (
        this.options.autoShrink &&
        drop.r <= this.options.minR &&
        chance(0.05 * timeScale)
      ) {
        drop.shrink += 0.01;
      }
      drop.r -= drop.shrink * timeScale;
      if (drop.r <= 0) {
        drop.killed = true;
      }

      if (this.options.raining) {
        drop.lastSpawn += drop.momentum * timeScale * this.options.trailRate;
        if (drop.lastSpawn > drop.nextSpawn) {
          const trailDrop = this.createDrop({
            x: drop.x + rnd(-drop.r, drop.r) * 0.1,
            y: drop.y - drop.r * 0.01,
            r:
              drop.r *
              rnd(
                this.options.trailScaleRange[0],
                this.options.trailScaleRange[1],
              ),
            spreadY: drop.momentum * 0.1,
            parent: drop,
            momentum: 0,
            momentumX: 0,
            lastSpawn: 0,
            nextSpawn: 0,
            spreadX: 0,
            isNew: true,
            killed: false,
            shrink: 0,
          });
          if (trailDrop) {
            newDrops.push(trailDrop);
            drop.r *= 0.97 ** timeScale;
            drop.lastSpawn = 0;
            drop.nextSpawn =
              rnd(this.options.minR, this.options.maxR) -
              drop.momentum * 2 * this.options.trailRate +
              (this.options.maxR - drop.r);
          }
        }
      }

      drop.spreadX *= 0.4 ** timeScale;
      drop.spreadY *= 0.7 ** timeScale;

      const moved = drop.momentum > 0;
      if (moved && !drop.killed) {
        drop.y += drop.momentum * this.options.globalTimeScale;
        drop.x += drop.momentumX * this.options.globalTimeScale;
        if (drop.y > this.height / this.scale + drop.r) {
          drop.killed = true;
        }
      }

      const checkCollision = (moved || drop.isNew) && !drop.killed;
      drop.isNew = false;
      if (checkCollision) {
        this.drops.slice(i + 1, i + 70).forEach((drop2) => {
          if (
            drop === drop2 ||
            drop.r <= drop2.r ||
            drop.parent === drop2 ||
            drop2.parent === drop ||
            drop2.killed
          ) {
            return;
          }
          const dx = drop2.x - drop.x;
          const dy = drop2.y - drop.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (
            dist <
            (drop.r + drop2.r) *
              (this.options.collisionRadius +
                drop.momentum *
                  this.options.collisionRadiusIncrease *
                  timeScale)
          ) {
            const r1 = drop.r;
            const r2 = drop2.r;
            const a1 = Math.PI * r1 * r1;
            const a2 = Math.PI * r2 * r2;
            let targetR = Math.sqrt((a1 + a2 * 0.8) / Math.PI);
            if (targetR > this.options.maxR) {
              targetR = this.options.maxR;
            }
            drop.r = targetR;
            drop.momentumX += dx * 0.1;
            drop.spreadX = 0;
            drop.spreadY = 0;
            drop2.killed = true;
            drop.momentum = Math.max(
              drop2.momentum,
              Math.min(
                40,
                drop.momentum +
                  targetR * this.options.collisionBoostMultiplier +
                  this.options.collisionBoost,
              ),
            );
          }
        });
      }

      drop.momentum -=
        Math.max(1, this.options.minR * 0.5 - drop.momentum) * 0.1 * timeScale;
      if (drop.momentum < 0) {
        drop.momentum = 0;
      }
      drop.momentumX *= 0.7 ** timeScale;

      if (!drop.killed) {
        newDrops.push(drop);
        if (moved && this.options.dropletsRate > 0) {
          this.clearDroplets(
            drop.x,
            drop.y,
            drop.r * this.options.dropletsCleaningRadiusMultiplier,
          );
        }
        this.drawDrop(this.ctx, drop);
      }
    });

    this.drops = newDrops;
  }
}
