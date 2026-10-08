import { LottiePlayback } from '../../packages/plugin-lottie/src/playback';

test('pause, seek, speed and reversal preserve the current composition position', () => {
  const clock = new LottiePlayback(1000, Infinity);
  clock.play(0);
  expect(clock.tick(200)).toBe(200);
  clock.setSpeed(2, 200);
  expect(clock.tick(300)).toBe(400);
  clock.setDirection(-1, 300);
  expect(clock.currentTime).toBe(400);
  expect(clock.tick(350)).toBe(300);
  clock.pause(375);
  expect(clock.tick(5000)).toBe(250);
  clock.seek(800, 5000);
  clock.play(5000);
  expect(clock.tick(5050)).toBe(700);
  clock.seek(500, 5050);
  expect(clock.tick(5100)).toBe(400);
  clock.stop();
  expect(clock.state).toBe('paused');
  expect(clock.tick(9000)).toBe(0);
});

test('finite playback ends, restarts, and keeps loops synchronized after a long frame', () => {
  const clock = new LottiePlayback(1000, 3);
  clock.play(0);
  expect(clock.tick(2250)).toBe(250);
  expect(clock.state).toBe('running');
  expect(clock.tick(3000)).toBe(1000);
  expect(clock.state).toBe('finished');
  clock.play(4000);
  expect(clock.tick(4100)).toBe(100);
  const reverse = new LottiePlayback(1000, 1);
  reverse.setDirection(-1, 0);
  reverse.play(0);
  expect(reverse.currentTime).toBe(1000);
  expect(reverse.tick(1000)).toBe(0);
  expect(reverse.state).toBe('finished');
});

test('segments honor both endpoints, direction, speed, looping and stop', () => {
  const clock = new LottiePlayback(1000, 1);
  clock.setSpeed(2, 0);
  clock.playSegments(200, 600, 0);
  expect(clock.tick(100)).toBe(400);
  expect(clock.tick(300)).toBe(600);
  expect(clock.state).toBe('finished');
  clock.playSegments(600, 200, 400);
  expect(clock.tick(500)).toBe(400);
  expect(clock.tick(700)).toBe(200);
  expect(clock.state).toBe('finished');
  clock.stop();
  clock.play(800);
  expect(clock.tick(900)).toBe(800);
  const looping = new LottiePlayback(1000, Infinity);
  looping.playSegments(200, 600, 0);
  expect(looping.tick(950)).toBe(350);
});

test('invalid controls do not corrupt playback', () => {
  const clock = new LottiePlayback(1000, 1);
  for (const speed of [0, -1, NaN, Infinity])
    expect(() => clock.setSpeed(speed, 0)).toThrow();
  expect(() => clock.seek(NaN, 0)).toThrow();
  expect(() => clock.playSegments(100, 100, 0)).toThrow();
  expect(() => clock.playSegments(-10, 100, 0)).toThrow();
  expect(() => clock.playSegments(0, 1001, 0)).toThrow();
  expect(clock.currentTime).toBe(0);
});
