import EventEmitter from 'eventemitter3';
import { FederatedEvent } from '../../events/FederatedEvent';
import { IPointData, Point } from '@pixi/math';
import { PluginContext } from '../../plugins';
import { Group } from '../Group';

export enum PenEvent {
  START = 'start',
  MOVE = 'move',
  MODIFIED = 'modified',
  CANCEL = 'cancel',
  COMPLETE = 'complete',
}

export interface PenState {
  id: number;
  points: IPointData[];
  isDrawing: boolean;
}

export interface PenStyle {}

export function getWidthFromBBox(points: IPointData[]) {
  const [tl, tr] = points;
  const dy = tr.y - tl.y;
  const dx = tr.x - tl.x;
  return Math.sqrt(dy * dy + dx * dx);
}

export function getHeightFromBBox(points: IPointData[]) {
  const [, tr, br] = points;
  const dy = br.y - tr.y;
  const dx = br.x - tr.x;
  return Math.sqrt(dy * dy + dx * dx);
}

export function getBBoxFromState(state: PenState) {
  const { points } = state;
  const [tl] = points;
  const { x, y } = tl;
  const width = getWidthFromBBox(points);
  const height = getHeightFromBBox(points);
  return {
    minX: x,
    minY: y,
    maxX: x + width,
    maxY: y + height,
  };
}

export abstract class AbstractPen extends EventEmitter {
  id: number;

  /**
   * Points along the pen's path.
   */
  points: Point[] = [];

  /**
   * Whether the pen is drawing.
   */
  isDrawing = false;

  constructor(protected api: PluginContext['api'], protected layer: Group) {
    super();
  }

  abstract onMouseDown(e: FederatedEvent): void;
  abstract onMouseMove(e: FederatedEvent): void;
  abstract onMouseUp(e: FederatedEvent): void;
  abstract onMouseDbClick(e: FederatedEvent): void;
  abstract onKeyDown(e: KeyboardEvent): void;

  abstract render(state: PenState, style: PenStyle): void;

  abstract hide(): void;

  abstract destroy(): void;

  protected reset() {
    this.id = undefined;
    this.isDrawing = false;
    this.points = [];
  }
}
