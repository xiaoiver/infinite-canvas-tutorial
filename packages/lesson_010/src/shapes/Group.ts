import { Shape } from './Shape';
import { AABB } from './AABB';

export class Group extends Shape {
  renderable = false;

  getDrawcallCtors() {
    return [];
  }
  containsPoint(x: number, y: number): boolean {
    throw new Error('Method not implemented.');
  }
  getGeometryBounds(): AABB {
    throw new Error('Method not implemented.');
  }
  getRenderBounds(): AABB {
    throw new Error('Method not implemented.');
  }
  destroy(): void {}
}
