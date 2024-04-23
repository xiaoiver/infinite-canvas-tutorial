import type { Shape } from '../shapes';
import type { FederatedEventTarget } from './FederatedEventTarget';

/**
 * The tracking data for each pointer held in the state of an {@link EventBoundary}.
 *
 * ```ts
 * pressTargetsByButton: {
 *     [id: number]: FederatedEventTarget[];
 * };
 * clicksByButton: {
 *     [id: number]: {
 *         clickCount: number;
 *         target: FederatedEventTarget;
 *         timeStamp: number;
 *     };
 * };
 * overTargets: FederatedEventTarget[];
 * ```
 * @typedef {object} TrackingData
 * @property {Record.<number, FederatedEventTarget>} pressTargetsByButton - The pressed containers'
 *  propagation paths by each button of the pointer.
 * @property {Record.<number, object>} clicksByButton - Holds clicking data for each button of the pointer.
 * @property {Container[]} overTargets - The Container propagation path over which the pointer is hovering.
 * @memberof events
 */
export type TrackingData = {
  pressTargetsByButton: {
    [id: number]: FederatedEventTarget[];
  };
  clicksByButton: {
    [id: number]: {
      clickCount: number;
      target: FederatedEventTarget;
      timeStamp: number;
    };
  };
  overTargets: FederatedEventTarget[];
};

/**
 * Internal storage of an event listener in EventEmitter.
 * @ignore
 */
type EmitterListener = { fn(...args: any[]): any; context: any; once: boolean };

/**
 * Internal storage of event listeners in EventEmitter.
 * @ignore
 */
export type EmitterListeners = Record<
  string,
  EmitterListener | EmitterListener[]
>;

export type Picker = (x: number, y: number) => Shape | null;
