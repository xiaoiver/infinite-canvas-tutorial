import type { Device } from '@infinite-canvas-tutorial/device-api';
import type { EcsGPUParticle } from './EcsGPUParticle';

export interface EcsSpectrumParticleAudioOptions {
  canvasElement: HTMLCanvasElement;
  effect: EcsGPUParticle;
  data?: HTMLMediaElement;
}

/**
 * Drives {@link EcsGPUParticle} with Web Audio analyser data (same role as {@link Audio} for core canvas).
 */
export class EcsSpectrumParticleAudio {
  private analyser?: AnalyserNode;
  private dataArray: Uint8Array = new Uint8Array(512).fill(0);
  private timer: number | undefined;
  private mouse = { pos: { x: 0, y: 0 }, click: 0 };
  private device: Device | undefined;
  private inited = false;

  constructor(private options: EcsSpectrumParticleAudioOptions) {
    if (options.data) {
      this.initAnalyser();
    }
    this.initMouseListener();
  }

  private initAnalyser() {
    const { data } = this.options;
    if (!data) {
      return;
    }
    const context = new AudioContext();
    const src = context.createMediaElementSource(data);
    const analyser = context.createAnalyser();
    this.analyser = analyser;
    src.connect(analyser);
    analyser.connect(context.destination);
    analyser.fftSize = 512;
    const bufferLength = analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
  }

  private initMouseListener() {
    const { canvasElement } = this.options;
    const mouse = this.mouse;

    canvasElement.addEventListener('mousemove', (e: MouseEvent) => {
      if (mouse.click) {
        mouse.pos.x = e.offsetX;
        mouse.pos.y = e.offsetY;
      }
    });
    canvasElement.addEventListener('mousedown', () => {
      mouse.click = 1;
    });
    canvasElement.addEventListener('mouseup', () => {
      mouse.click = 0;
    });
  }

  /** Must be called once before {@link play} (pass ECS canvas GPU device). */
  async connect(device: Device): Promise<void> {
    this.device = device;
    await this.options.effect.init({
      device,
      canvas: this.options.canvasElement,
    });
    this.inited = true;
  }

  data($audio: HTMLMediaElement) {
    this.options.data = $audio;
    this.initAnalyser();
    return this;
  }

  effect(effect: EcsGPUParticle) {
    if (this.options.effect && effect !== this.options.effect) {
      this.options.effect.destroy();
    }
    this.options.effect = effect;
    this.inited = false;
    return this;
  }

  async play() {
    if (!this.inited || !this.device) {
      throw new Error('EcsSpectrumParticleAudio: call connect(device) before play()');
    }

    let frame = 0;
    const tick = (elapsed: number) => {
      this.analyser?.getByteFrequencyData(this.dataArray);
      this.options.effect.frame(
        frame,
        elapsed / 1000,
        this.mouse,
        this.dataArray,
      );
      this.options.effect.renderFrame();

      frame++;
      this.timer = requestAnimationFrame(tick);
    };

    this.timer = requestAnimationFrame(tick);
  }

  stop() {
    if (this.timer !== undefined) {
      cancelAnimationFrame(this.timer);
      this.timer = undefined;
    }
  }

  resize() {
    const { canvasElement, effect } = this.options;
    effect.resize(canvasElement.width, canvasElement.height);
  }

  destroy() {
    this.stop();
    this.options.effect.destroy();
  }
}
