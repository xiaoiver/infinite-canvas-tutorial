import type EventEmitter from 'eventemitter3';
import type { Rectangle } from '@pixi/math';
import type { FederatedPointerEvent } from './FederatedPointerEvent';

/**
 * The type of cursor to use when the mouse pointer is hovering over.
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
 *
 * Can be any valid CSS cursor value:
 * `auto`, `default`, `none`, `context-menu`, `help`, `pointer`, `progress`,
 * `wait`, `cell`, `crosshair`, `text`, `verticaltext`, `alias`, `copy`, `move`,
 * `nodrop`, `notallowed`, `eresize`, `nresize`, `neresize`, `nwresize`, `sresize`,
 *  `seresize`, `swresize`, `wresize`, `nsresize`, `ewresize`, `neswresize`, `colresize`,
 *  `nwseresize`, `rowresize`, `allscroll`, `zoomin`, `zoomout`, `grab`, `grabbing`
 * @memberof events
 */
export type Cursor =
  | 'auto'
  | 'default'
  | 'none'
  | 'context-menu'
  | 'help'
  | 'pointer'
  | 'progress'
  | 'wait'
  | 'cell'
  | 'crosshair'
  | 'text'
  | 'vertical-text'
  | 'alias'
  | 'copy'
  | 'move'
  | 'no-drop'
  | 'not-allowed'
  | 'e-resize'
  | 'n-resize'
  | 'ne-resize'
  | 'nw-resize'
  | 's-resize'
  | 'se-resize'
  | 'sw-resize'
  | 'w-resize'
  | 'ns-resize'
  | 'ew-resize'
  | 'nesw-resize'
  | 'col-resize'
  | 'nwse-resize'
  | 'row-resize'
  | 'all-scroll'
  | 'zoom-in'
  | 'zoom-out'
  | 'grab'
  | 'grabbing';

/**
 * The properties available for any interactive object.
 * @memberof events
 */
export interface FederatedOptions {
  /** The cursor preferred when the mouse pointer is hovering over. */
  cursor?: Cursor | string;
}

/**
 * A simplified shape of an interactive object for the `eventTarget` property of a {@link FederatedEvent}
 * @memberof events
 */
export interface FederatedEventTarget
  extends EventEmitter,
    EventTarget,
    Required<FederatedOptions> {
  /** The parent of this event target. */
  readonly parent?: FederatedEventTarget;

  /** The children of this event target. */
  readonly children?: ReadonlyArray<FederatedEventTarget>;

  /**
   * Interaction shape. Children will be hit first, then this shape will be checked.
   * Setting this will cause this shape to be checked in hit tests rather than the container's bounds.
   */
  hitArea?: Rectangle;

  draggable: boolean;
  droppable: boolean;

  /** Remove all listeners, or those of the specified event. */
  removeAllListeners(event?: string | symbol): this;
}

/**
 * Function type for handlers, e.g., onclick
 * @memberof events
 */
export type FederatedEventHandler<T = FederatedPointerEvent> = (
  event: T,
) => void;
