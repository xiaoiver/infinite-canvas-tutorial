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
      this.mask.position.x += dx;
      this.mask.position.y += dy;
    };

    this.addEventListener('dragstart', (e: FederatedPointerEvent) => {
      const target = e.target as Shape;

      if (target === this.mask) {
        const { x, y } = this.mask.position;

        shiftX = e.screen.x - x;
        shiftY = e.screen.y - y;

        moveAt(e.screen.x, e.screen.y);
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
        if (target === this.tlAnchor) {
        } else if (target === this.trAnchor) {
          const { cx: blCx, cy: blCy } = this.blAnchor;
          this.trAnchor.cx = x;
          this.trAnchor.cy = y;
          this.tlAnchor.cx = blCx;
          this.tlAnchor.cy = y;
          this.brAnchor.cx = x;
          this.brAnchor.cy = blCy;
          this.mask;
        } else if (target === this.blAnchor) {
        } else if (target === this.brAnchor) {
        }
        //   // resize mask
        //   this.mask.d = `M${maskX} ${maskY}L${maskX + maskWidth} ${maskY}L${
        //     maskX + maskWidth
        //   } ${maskY + maskHeight}L${maskX} ${maskY + maskHeight}Z`;
        //   // re-position anchors
        //   this.tlAnchor.cx = maskX;
        //   this.tlAnchor.cy = maskY;
        //   this.trAnchor.cx = maskX + maskWidth;
        //   this.trAnchor.cy = maskY;
        //   this.blAnchor.cx = maskX;
        //   this.blAnchor.cy = maskY + maskHeight;
        //   this.brAnchor.cx = maskX + maskWidth;
        //   this.brAnchor.cy = maskY + maskHeight;
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

        console.log(tlCx, tlCy, trCx, trCy, brCx, brCy, blCx, blCy);
        console.log(this.mask.position.x, this.mask.position.y);

        this.mask.position.x = 0;
        this.mask.position.y = 0;
        this.mask.d = `M${tlCx} ${tlCy}L${trCx} ${trCy}L${brCx} ${brCy}L${blCx} ${blCy}Z`;
      } else if (
        target === this.tlAnchor ||
        target === this.trAnchor ||
        target === this.blAnchor ||
        target === this.brAnchor
      ) {
        // targetObject.dispatchEvent(
        //   new CustomEvent(SelectableEvent.MODIFIED, {
        //     rect: {
        //       x: maskX,
        //       y: maskY,
        //       width: maskWidth,
        //       height: maskHeight,
        //     },
        //   }),
        // );
      }
    });
  }
}
