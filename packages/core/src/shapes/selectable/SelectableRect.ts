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
          const { cx: brCx, cy: brCy } = this.brAnchor;
          this.tlAnchor.cx = x;
          this.tlAnchor.cy = y;
          this.trAnchor.cx = brCx;
          this.trAnchor.cy = y;
          this.blAnchor.cx = x;
          this.blAnchor.cy = brCy;
        } else if (target === this.trAnchor) {
          const { cx: blCx, cy: blCy } = this.blAnchor;
          this.trAnchor.cx = x;
          this.trAnchor.cy = y;
          this.tlAnchor.cx = blCx;
          this.tlAnchor.cy = y;
          this.brAnchor.cx = x;
          this.brAnchor.cy = blCy;
        } else if (target === this.blAnchor) {
          const { cx: trCx, cy: trCy } = this.trAnchor;
          this.blAnchor.cx = x;
          this.blAnchor.cy = y;
          this.brAnchor.cx = trCx;
          this.brAnchor.cy = y;
          this.tlAnchor.cx = x;
          this.tlAnchor.cy = trCy;
        } else if (target === this.brAnchor) {
          const { cx: tlCx, cy: tlCy } = this.tlAnchor;
          this.brAnchor.cx = x;
          this.brAnchor.cy = y;
          this.blAnchor.cx = tlCx;
          this.blAnchor.cy = y;
          this.trAnchor.cx = x;
          this.trAnchor.cy = tlCy;
        }

        this.mask.d = `M${this.tlAnchor.cx} ${this.tlAnchor.cy}L${this.trAnchor.cx} ${this.trAnchor.cy}L${this.brAnchor.cx} ${this.brAnchor.cy}L${this.blAnchor.cx} ${this.blAnchor.cy}Z`;
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

        const { cx: tlCx, cy: tlCy } = this.tlAnchor;
        const { cx: trCx, cy: trCy } = this.trAnchor;
        const { cx: brCx, cy: brCy } = this.brAnchor;
        const { cx: blCx, cy: blCy } = this.blAnchor;

        this.mask.position.x = 0;
        this.mask.position.y = 0;
        this.mask.d = `M${tlCx} ${tlCy}L${trCx} ${trCy}L${brCx} ${brCy}L${blCx} ${blCy}Z`;
      }
    });
  }
}
