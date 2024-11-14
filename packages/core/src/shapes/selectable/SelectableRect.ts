// import { Circle } from '../Circle';
import { Rect } from '../Rect';
import { AbstractSelectable } from './AbstractSelectable';

export class SelectableRect extends AbstractSelectable {
  mask: Rect;
  // #tlAnchor: Circle;
  // #trAnchor: Circle;
  // #blAnchor: Circle;
  // #brAnchor: Circle;

  init() {
    // account for world transform
    // const bounds = new AABB();
    // bounds.addBounds(
    //   this.target.getGeometryBounds(),
    //   this.target.worldTransform,
    // );
    const bounds = this.target.getBounds();
    const { minX, minY, maxX, maxY } = bounds;

    this.mask = new Rect({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      fill: 'red',
      opacity: 0.5,
      cursor: 'move',
      sizeAttenuation: true,
      batchable: false,
    });
    this.appendChild(this.mask);

    // this.#tlAnchor = new Circle({
    //   r: anchorSize,
    //   cursor: 'nwse-resize',
    //   draggable: true,
    //   isSizeAttenuation: true,
    //   stroke: anchorStroke,
    //   fill: anchorFill,
    //   fillOpacity: anchorFillOpacity,
    //   strokeOpacity: anchorStrokeOpacity,
    //   lineWidth: anchorStrokeWidth,
    //   batchable: false,
    //   cullable: false,
    // });
  }
}
