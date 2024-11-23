import { AABB } from '../AABB';
import { Circle } from '../Circle';
import { Rect } from '../Rect';
import { AbstractSelectable } from './AbstractSelectable';

export class SelectableRect extends AbstractSelectable {
  mask: Rect;
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

    this.mask = new Rect({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      fill: this.maskFill,
      fillOpacity: this.maskFillOpacity,
      stroke: this.maskStroke,
      strokeOpacity: this.maskStrokeOpacity,
      strokeWidth: this.maskStrokeWidth,
      opacity: this.maskOpacity,
      cursor: 'move',
      sizeAttenuation: true,
      batchable: false,
      cullable: false,
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
  }
}
