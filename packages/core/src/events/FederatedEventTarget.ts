import type EventEmitter from 'eventemitter3';
import type { Rectangle } from '@pixi/math';
import type { FederatedPointerEvent } from './FederatedPointerEvent';

export type PointerEvents =
  | 'none'
  | 'auto'
  | 'stroke'
  | 'fill'
  | 'painted'
  | 'visible'
  | 'visiblestroke'
  | 'visiblefill'
  | 'visiblepainted'
  | 'all'
  | 'non-transparent-pixel';

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
  /**
   * It sets under what circumstances (if any) a particular graphic element can become the target of pointer events.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
   */
  pointerEvents: PointerEvents;

  /**
   * It sets the mouse cursor, if any, to show when the mouse pointer is over an element.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
   */
  cursor: Cursor | string;

  /**
   * Interaction shape. Children will be hit first, then this shape will be checked.
   * Setting this will cause this shape to be checked in hit tests rather than the container's bounds.
   */
  hitArea: Rectangle | undefined;

  /**
   * Whether this object is draggable. Used in {@link DragAndDrop} plugin.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/draggable
   */
  draggable: boolean;

  /**
   * Whether this object is droppable. Used in {@link DragAndDrop} plugin.
   */
  droppable: boolean;
}

/**
 * A simplified shape of an interactive object for the `eventTarget` property of a {@link FederatedEvent}
 * @memberof events
 */
export interface FederatedEventTarget
  extends EventEmitter,
    EventTarget,
    FederatedOptions {
  pointerEvents: PointerEvents;
  hitArea: Rectangle;
  cursor: Cursor | string;
  draggable: boolean;
  droppable: boolean;
  
  /** The parent of this event target. */
  readonly parent?: FederatedEventTarget;

  /** The children of this event target. */
  readonly children?: ReadonlyArray<FederatedEventTarget>;

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
