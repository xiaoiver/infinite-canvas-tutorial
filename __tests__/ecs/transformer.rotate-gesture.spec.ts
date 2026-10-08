import {
  rotateGestureOBB,
  type RotateGesture,
} from '../../packages/ecs/src/systems/select/rotate-gesture';

it.each([1, -1])(
  'keeps a pinned pivot fixed across full turns and reversal (scaleX=%s)',
  (scaleX) => {
    const obb = {
      x: 100,
      y: 80,
      width: 90,
      height: 50,
      rotation: 0,
      scaleX,
      scaleY: -1,
    };
    const pivotLocal: [number, number] = [17, 31];
    const pivotWorld: [number, number] = [100 + 17 * scaleX, 49];
    const gesture: RotateGesture = {
      obb,
      pivotLocal,
      pivotWorld,
      lastPointerAngle: (170 * Math.PI) / 180,
      accumulated: 0,
    };
    // Cross atan2's branch cut, complete two turns, then reverse to the start.
    const angles = [
      190, 280, 370, 460, 550, 640, 730, 820, 890, 800, 710, 620, 530, 440, 350,
      260, 170,
    ];
    for (const degrees of angles) {
      const angle = (degrees * Math.PI) / 180;
      const next = rotateGestureOBB(gesture, {
        x: pivotWorld[0] + 70 * Math.cos(angle),
        y: pivotWorld[1] + 70 * Math.sin(angle),
      });
      expect(next.rotation).toBeCloseTo(((degrees - 170) * Math.PI) / 180, 8);
      const x = pivotLocal[0] * next.scaleX;
      const y = pivotLocal[1] * next.scaleY;
      expect(
        next.x + x * Math.cos(next.rotation) - y * Math.sin(next.rotation),
      ).toBeCloseTo(pivotWorld[0], 8);
      expect(
        next.y + x * Math.sin(next.rotation) + y * Math.cos(next.rotation),
      ).toBeCloseTo(pivotWorld[1], 8);
      expect([next.width, next.height, next.scaleX, next.scaleY]).toEqual([
        90,
        50,
        scaleX,
        -1,
      ]);
    }
    expect(obb).toEqual({
      x: 100,
      y: 80,
      width: 90,
      height: 50,
      rotation: 0,
      scaleX,
      scaleY: -1,
    });
  },
);
