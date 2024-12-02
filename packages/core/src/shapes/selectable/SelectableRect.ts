import { FederatedEvent, FederatedPointerEvent } from '../../events';
import { AABB } from '../AABB';
import { Circle } from '../Circle';
import { Path } from '../Path';
import { Shape } from '../Shape';
import { AbstractSelectable } from './AbstractSelectable';

export class SelectableRect extends AbstractSelectable {
  mask: Path;
  tlAnchor: Circle;
  trAnchor: Circle;
  blAnchor: Circle;
  brAnchor: Circle;

  init() {
    // account for world transform
    const bounds = new AABB();
    bounds.addBounds(
      this.target.getGeometryBounds(),
      this.target.worldTransform,
    );
    // const bounds = this.target.getBounds();
    const { minX, minY, maxX, maxY } = bounds;

    this.mask = new Path({
      d: `M${minX} ${minY}L${maxX} ${minY}L${maxX} ${maxY}L${minX} ${maxY}Z`,
      fill: this.maskFill,
      fillOpacity: this.maskFillOpacity,
      stroke: this.maskStroke,
      strokeOpacity: this.maskStrokeOpacity,
      strokeWidth: this.maskStrokeWidth,
      opacity: this.maskOpacity,
      cursor: 'move',
      batchable: false,
      cullable: false,
      draggable: true,
      sizeAttenuation: true,
      selectable: false,
    });
    this.appendChild(this.mask);

    const anchorAttributes = {
      r: this.anchorSize,
      draggable: true,
      sizeAttenuation: true,
      stroke: this.anchorStroke,
      fill: this.anchorFill,
      fillOpacity: this.anchorFillOpacity,
      strokeOpacity: this.anchorStrokeOpacity,
      strokeWidth: this.anchorStrokeWidth,
      opacity: this.anchorOpacity,
      batchable: false,
      cullable: false,
      selectable: false,
    };

    this.tlAnchor = new Circle({
      cx: minX,
      cy: minY,
      cursor: 'nwse-resize',
      ...anchorAttributes,
    });

    this.trAnchor = new Circle({
      cx: maxX,
      cy: minY,
      cursor: 'nesw-resize',
      ...anchorAttributes,
    });

    this.blAnchor = new Circle({
      cx: minX,
      cy: maxY,
      cursor: 'nesw-resize',
      ...anchorAttributes,
    });

    this.brAnchor = new Circle({
      cx: maxX,
      cy: maxY,
      cursor: 'nwse-resize',
      ...anchorAttributes,
    });

    this.mask.appendChild(this.tlAnchor);
    this.mask.appendChild(this.trAnchor);
    this.mask.appendChild(this.blAnchor);
    this.mask.appendChild(this.brAnchor);

    this.bindEventListeners();
  }

  triggerMovingEvent(dx: number, dy: number) {
    // @ts-expect-error - CustomEventInit is not defined
    this.plugin.movingEvent.detail = {
      dx,
      dy,
    };
    this.target.dispatchEvent(this.plugin.movingEvent);
  }

  triggerMovedEvent() {
    this.target.dispatchEvent(this.plugin.movingEvent);
  }

  private bindEventListeners() {
    // listen to drag'n'drop events
    let shiftX = 0;
    let shiftY = 0;
    const moveAt = (canvasX: number, canvasY: number) => {
      const { x, y } = this.mask.position;
      const dx = canvasX - shiftX - x;
      const dy = canvasY - shiftY - y;

      // account for multi-selection
      this.plugin.selected.forEach((selected) => {
        const selectable = this.plugin.getOrCreateSelectable(selected);
        selectable.triggerMovingEvent(dx, dy);
      });

      // move mask
      this.mask.position.x = canvasX - shiftX;
      this.mask.position.y = canvasY - shiftY;
    };

    this.addEventListener('dragstart', (e: FederatedPointerEvent) => {
      const target = e.target as Shape;
      if (target === this.mask) {
        shiftX = e.screen.x;
        shiftY = e.screen.y;
      }
    });

    this.addEventListener('drag', (e: FederatedPointerEvent) => {
      const target = e.target as Shape;
      const { x, y } = e.screen;

      if (target === this.mask) {
        moveAt(x, y);
      } else if (
        target === this.tlAnchor ||
        target === this.trAnchor ||
        target === this.blAnchor ||
        target === this.brAnchor
      ) {
        // TODO: account for target's rotation
        if (target === this.tlAnchor) {
          this.tlAnchor.position.x = x - this.tlAnchor.cx;
          this.tlAnchor.position.y = y - this.tlAnchor.cy;
          this.trAnchor.position.y = this.tlAnchor.position.y;
          this.blAnchor.position.x = this.tlAnchor.position.x;
        } else if (target === this.trAnchor) {
          this.trAnchor.position.x = x - this.trAnchor.cx;
          this.trAnchor.position.y = y - this.trAnchor.cy;
          this.tlAnchor.position.y = y - this.tlAnchor.cy;
          this.brAnchor.position.x = x - this.brAnchor.cx;
        } else if (target === this.blAnchor) {
          this.blAnchor.position.x = x - this.blAnchor.cx;
          this.blAnchor.position.y = y - this.blAnchor.cy;
          this.brAnchor.position.y = y - this.brAnchor.cy;
          this.tlAnchor.position.x = x - this.tlAnchor.cx;
        } else if (target === this.brAnchor) {
          this.brAnchor.position.x = x - this.brAnchor.cx;
          this.brAnchor.position.y = y - this.brAnchor.cy;
          this.blAnchor.position.y = y - this.blAnchor.cy;
          this.trAnchor.position.x = x - this.trAnchor.cx;
        }

        this.mask.d = `M${this.tlAnchor.cx + this.tlAnchor.position.x} ${
          this.tlAnchor.cy + this.tlAnchor.position.y
        }L${this.trAnchor.cx + this.trAnchor.position.x} ${
          this.trAnchor.cy + this.trAnchor.position.y
        }L${this.brAnchor.cx + this.brAnchor.position.x} ${
          this.brAnchor.cy + this.brAnchor.position.y
        }L${this.blAnchor.cx + this.blAnchor.position.x} ${
          this.blAnchor.cy + this.blAnchor.position.y
        }Z`;

        // @ts-expect-error - CustomEventInit is not defined
        this.plugin.resizingEvent.detail = {
          tlX: this.tlAnchor.cx + this.tlAnchor.position.x,
          tlY: this.tlAnchor.cy + this.tlAnchor.position.y,
          brX: this.brAnchor.cx + this.brAnchor.position.x,
          brY: this.brAnchor.cy + this.brAnchor.position.y,
        };
        this.target.dispatchEvent(this.plugin.resizingEvent);
      }
    });

    this.addEventListener('dragend', (e: FederatedEvent) => {
      const target = e.target as Shape;
      if (target === this.mask) {
        // account for multi-selection
        this.plugin.selected.forEach((selected) => {
          const selectable = this.plugin.getOrCreateSelectable(selected);
          selectable.triggerMovedEvent();
        });

        this.tlAnchor.cx += this.mask.position.x;
        this.tlAnchor.cy += this.mask.position.y;
        this.trAnchor.cx += this.mask.position.x;
        this.trAnchor.cy += this.mask.position.y;
        this.blAnchor.cx += this.mask.position.x;
        this.blAnchor.cy += this.mask.position.y;
        this.brAnchor.cx += this.mask.position.x;
        this.brAnchor.cy += this.mask.position.y;

        this.mask.position.x = 0;
        this.mask.position.y = 0;

        this.target.dispatchEvent(this.plugin.movedEvent);
      } else if (
        target === this.tlAnchor ||
        target === this.trAnchor ||
        target === this.blAnchor ||
        target === this.brAnchor
      ) {
        this.tlAnchor.cx = this.tlAnchor.position.x + this.tlAnchor.cx;
        this.tlAnchor.cy = this.tlAnchor.position.y + this.tlAnchor.cy;
        this.tlAnchor.position.x = 0;
        this.tlAnchor.position.y = 0;

        this.trAnchor.cx = this.trAnchor.position.x + this.trAnchor.cx;
        this.trAnchor.cy = this.trAnchor.position.y + this.trAnchor.cy;
        this.trAnchor.position.x = 0;
        this.trAnchor.position.y = 0;

        this.blAnchor.cx = this.blAnchor.position.x + this.blAnchor.cx;
        this.blAnchor.cy = this.blAnchor.position.y + this.blAnchor.cy;
        this.blAnchor.position.x = 0;
        this.blAnchor.position.y = 0;

        this.brAnchor.cx = this.brAnchor.position.x + this.brAnchor.cx;
        this.brAnchor.cy = this.brAnchor.position.y + this.brAnchor.cy;
        this.brAnchor.position.x = 0;
        this.brAnchor.position.y = 0;

        // @ts-expect-error - CustomEventInit is not defined
        this.plugin.resizedEvent.detail = {
          tlX: this.tlAnchor.cx,
          tlY: this.tlAnchor.cy,
          brX: this.brAnchor.cx,
          brY: this.brAnchor.cy,
        };
        this.target.dispatchEvent(this.plugin.resizedEvent);
      }

      const { cx: tlCx, cy: tlCy } = this.tlAnchor;
      const { cx: trCx, cy: trCy } = this.trAnchor;
      const { cx: brCx, cy: brCy } = this.brAnchor;
      const { cx: blCx, cy: blCy } = this.blAnchor;
      this.mask.d = `M${tlCx} ${tlCy}L${trCx} ${trCy}L${brCx} ${brCy}L${blCx} ${blCy}Z`;
    });
  }
}
