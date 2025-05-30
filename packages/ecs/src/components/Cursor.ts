import { Entity, field, Type } from '@lastolivegames/becsy';

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
export type CursorValue =
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
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
 */
export class Cursor {
  @field.ref declare canvas: Entity;

  @field({ type: Type.dynamicString(2000), default: 'default' }) declare value:
    | CursorValue
    | string;

  constructor(value?: Partial<Cursor>) {
    Object.assign(this, value);
  }
}
