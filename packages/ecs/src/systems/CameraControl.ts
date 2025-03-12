import { mat3, vec2 } from 'gl-matrix';
import { co, System } from '@lastolivegames/becsy';
import { CanvasConfig, Event, InteractivePointerEvent } from '../components';
import { getGlobalThis } from '../utils';

export class CameraControl extends System {
  //   private readonly event = this.singleton.read(Event);

  initialize() {
    const startInvertViewProjectionMatrix = mat3.create();
    let startCameraX: number;
    let startCameraY: number;
    let startCameraRotation: number;
    const startPos = vec2.create();
    let startMousePos: vec2;
    let rotate = false;
  }

  execute() {
    // if (this.event.value) {
    //   console.log(this.event.value.type);
    // }
  }
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
const PINCH_FACTOR = 100;
const ZOOM_STEPS = [
  0.02, 0.05, 0.1, 0.15, 0.2, 0.33, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4,
];
export const findZoomCeil = (zoom: number) => {
  return (
    ZOOM_STEPS.find((step) => step > zoom) || ZOOM_STEPS[ZOOM_STEPS.length - 1]
  );
};
export const findZoomFloor = (zoom: number) => {
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom) || ZOOM_STEPS[0];
};
