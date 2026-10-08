/** One composition clock for all imported tracks. Times are milliseconds. */
export class LottiePlayback {
  currentTime = 0;
  state: 'paused' | 'running' | 'finished' = 'paused';
  speed = 1;
  direction: 1 | -1 = 1;
  private start = 0;
  private end: number;
  private remaining: number;
  private previousTime: number | undefined;

  constructor(readonly duration: number, private iterations: number) {
    this.end = duration;
    this.remaining = iterations;
  }

  tick(now: number) {
    if (this.state !== 'running') return this.currentTime;
    const delta = Math.max(0, now - (this.previousTime ?? now)) * this.speed;
    this.previousTime = now;
    const length = this.end - this.start;
    if (length <= 0) {
      this.state = 'finished';
      return this.currentTime;
    }
    const distance =
      (this.direction === 1
        ? this.currentTime - this.start
        : this.end - this.currentTime) + delta;
    const cycles = Math.floor(distance / length);
    if (cycles >= this.remaining) {
      this.currentTime = this.direction === 1 ? this.end : this.start;
      this.state = 'finished';
    } else {
      this.remaining -= cycles;
      const progress = distance % length;
      this.currentTime =
        this.direction === 1 ? this.start + progress : this.end - progress;
    }
    return this.currentTime;
  }

  play(now: number) {
    if (this.state === 'running') return;
    if (
      this.state === 'finished' ||
      (this.direction === 1
        ? this.currentTime >= this.end
        : this.currentTime <= this.start)
    ) {
      this.currentTime = this.direction === 1 ? this.start : this.end;
      this.remaining = this.iterations;
    }
    this.state = 'running';
    this.previousTime = now;
  }

  pause(now: number) {
    this.tick(now);
    this.state = 'paused';
    this.previousTime = undefined;
  }

  seek(time: number, now: number) {
    if (!Number.isFinite(time))
      throw new Error('Lottie seek time must be finite.');
    this.currentTime = Math.max(this.start, Math.min(this.end, time));
    this.remaining = this.iterations;
    this.previousTime = now;
    if (this.state === 'finished') this.state = 'paused';
  }

  stop() {
    this.start = 0;
    this.end = this.duration;
    this.currentTime = 0;
    this.remaining = this.iterations;
    this.state = 'paused';
    this.previousTime = undefined;
  }

  setSpeed(speed: number, now: number) {
    if (!Number.isFinite(speed) || speed <= 0)
      throw new Error('Lottie speed must be a finite positive number.');
    this.tick(now);
    this.speed = speed;
  }

  setDirection(direction: 1 | -1, now: number) {
    if (direction !== 1 && direction !== -1)
      throw new Error('Lottie direction must be 1 or -1.');
    this.tick(now);
    this.direction = direction;
  }

  playSegments(first: number, last: number, now: number) {
    if (
      ![first, last].every(
        (n) => Number.isFinite(n) && n >= 0 && n <= this.duration,
      ) ||
      first === last
    ) {
      throw new Error(
        'Lottie segment endpoints must be distinct and inside the composition.',
      );
    }
    this.start = Math.min(first, last);
    this.end = Math.max(first, last);
    this.direction = last > first ? 1 : -1;
    this.seek(first, now);
    this.state = 'paused';
    this.play(now);
  }
}
