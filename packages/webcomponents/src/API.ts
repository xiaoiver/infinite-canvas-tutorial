import {
  Canvas,
  ComputedCamera,
  Pen,
  SerializedNode,
  CheckboardStyle,
  API,
  Task,
  StateManagement,
  Commands,
  RectSerializedNode,
  CircleSerializedNode,
  EllipseSerializedNode,
  PolylineSerializedNode,
  PathSerializedNode,
  ComputedBounds,
  Polyline,
  serializePoints,
  TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { type LitElement } from 'lit';
import { Event } from './event';
import { isNil, path2Absolute, path2String } from '@antv/util';

/**
 * Since the canvas is created in the system, we need to store them here for later use.
 */
export const pendingCanvases: {
  container: LitElement;
  canvas: Partial<Canvas>;
  camera: Partial<ComputedCamera>;
}[] = [];

/**
 * Emit CustomEvents for the canvas.
 */
export class ExtendedAPI extends API {
  constructor(
    stateManagement: StateManagement,
    commands: Commands,
    public element: LitElement,
  ) {
    super(stateManagement, commands);
  }

  resizeCanvas(width: number, height: number) {
    super.resizeCanvas(width, height);

    this.element.dispatchEvent(
      new CustomEvent(Event.RESIZED, { detail: { width, height } }),
    );
  }

  setCheckboardStyle(checkboardStyle: CheckboardStyle) {
    super.setCheckboardStyle(checkboardStyle);

    this.element.dispatchEvent(
      new CustomEvent(Event.CHECKBOARD_STYLE_CHANGED, {
        detail: { checkboardStyle },
      }),
    );
  }

  setPen(pen: Pen) {
    super.setPen(pen);

    this.element.dispatchEvent(
      new CustomEvent(Event.PEN_CHANGED, {
        detail: { selected: [pen] },
      }),
    );
  }

  setTaskbars(selected: Task[]) {
    super.setTaskbars(selected);

    this.element.dispatchEvent(
      new CustomEvent(Event.TASK_CHANGED, { detail: { selected } }),
    );
  }

  selectNodes(selected: SerializedNode[], preserveSelection = false) {
    super.selectNodes(selected, preserveSelection);

    this.element.dispatchEvent(
      new CustomEvent(Event.SELECTED_NODES_CHANGED, {
        detail: { selected, preserveSelection },
      }),
    );
  }

  updateNodes(nodes: SerializedNode[]) {
    super.updateNodes(nodes);

    this.element.dispatchEvent(
      new CustomEvent(Event.NODES_UPDATED, {
        detail: {
          nodes,
        },
      }),
    );
  }

  deleteNodesById(ids: SerializedNode['id'][]) {
    const nodes = super.deleteNodesById(ids);

    this.element.dispatchEvent(
      new CustomEvent(Event.NODE_DELETED, {
        detail: {
          nodes,
        },
      }),
    );

    return nodes;
  }

  getNodeTransform(node: SerializedNode) {
    const { type } = node;
    let width = 0;
    let height = 0;
    let x = 0;
    let y = 0;
    let angle = 0;

    if (type === 'circle') {
      const { r, cx, cy } = node;
      width = r * 2;
      height = r * 2;
      x = cx - r;
      y = cy - r;
      angle = 0;
    } else if (type === 'ellipse') {
      const { rx, ry, cx, cy } = node;
      width = rx * 2;
      height = ry * 2;
      x = cx - rx;
      y = cy - ry;
      angle = 0;
    } else if (type === 'rect') {
      const { width: w, height: h, x: xx, y: yy } = node;
      width = w;
      height = h;
      x = xx;
      y = yy;
      angle = 0;
    } else if (type === 'polyline' || type === 'path' || type === 'text') {
      const { geometryBounds } = this.getEntity(node)?.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;
      width = maxX - minX;
      height = maxY - minY;
      x = minX;
      y = minY;
      angle = 0;
    }

    return { width, height, x, y, angle };
  }

  updateNodeTransform(
    node: SerializedNode,
    transform: Partial<{
      x: number;
      y: number;
      dx: number;
      dy: number;
      width: number;
      height: number;
    }>,
  ) {
    const { type, lockAspectRatio } = node;
    const { x, y, width, height } = transform;
    let { dx, dy } = transform;

    if (type === 'rect') {
      const diff: Partial<RectSerializedNode> = {};
      if (!isNil(x)) {
        diff.x = x;
      }
      if (!isNil(y)) {
        diff.y = y;
      }
      if (!isNil(dx)) {
        diff.x = (node.x || 0) + dx;
      }
      if (!isNil(dy)) {
        diff.y = (node.y || 0) + dy;
      }
      if (!isNil(width)) {
        if (lockAspectRatio) {
          const aspectRatio = node.width / node.height;
          diff.height = width / aspectRatio;
        }
        diff.width = width;
      }
      if (!isNil(height)) {
        if (lockAspectRatio) {
          const aspectRatio = node.width / node.height;
          diff.width = height * aspectRatio;
        }
        diff.height = height;
      }
      this.updateNode(node, diff);
    } else if (type === 'circle') {
      const diff: Partial<CircleSerializedNode> = {};
      const { cx = 0, cy = 0, r = 0 } = node;
      if (!isNil(x)) {
        diff.cx = x + r;
      }
      if (!isNil(y)) {
        diff.cy = y + r;
      }
      if (!isNil(dx)) {
        diff.cx = cx + dx;
      }
      if (!isNil(dy)) {
        diff.cy = cy + dy;
      }
      if (!isNil(width)) {
        diff.r = width / 2;
      }
      if (!isNil(height)) {
        diff.r = height / 2;
      }
      this.updateNode(node, diff);
    } else if (type === 'ellipse') {
      const diff: Partial<EllipseSerializedNode> = {};
      const { cx = 0, cy = 0, rx = 0, ry = 0 } = node;
      if (!isNil(x)) {
        diff.cx = x + rx;
      }
      if (!isNil(y)) {
        diff.cy = y + ry;
      }
      if (!isNil(dx)) {
        diff.cx = cx + dx;
      }
      if (!isNil(dy)) {
        diff.cy = cy + dy;
      }
      if (!isNil(width)) {
        if (lockAspectRatio) {
          const aspectRatio = node.rx / node.ry;
          diff.ry = width / aspectRatio / 2;
        }
        diff.rx = width / 2;
      }
      if (!isNil(height)) {
        if (lockAspectRatio) {
          const aspectRatio = node.rx / node.ry;
          diff.rx = (height * aspectRatio) / 2;
        }
        diff.ry = height / 2;
      }
      this.updateNode(node, diff);
    } else if (type === 'polyline') {
      const { x: prevX, y: prevY } = this.getNodeTransform(node);
      if (isNil(dx)) {
        dx = x - prevX;
      }
      if (isNil(dy)) {
        dy = y - prevY;
      }

      const points = this.getEntity(node)?.read(Polyline).points;
      const diff: Partial<PolylineSerializedNode> = {
        points: serializePoints(
          points.map(([x, y]) => {
            return [x + dx, y + dy];
          }),
        ),
      };
      this.updateNode(node, diff);
    } else if (type === 'path') {
      const { x: prevX, y: prevY } = this.getNodeTransform(node);
      if (!isNil(x) && isNil(dx)) {
        dx = x - prevX;
      }
      if (!isNil(y) && isNil(dy)) {
        dy = y - prevY;
      }

      const hasDx = !isNil(dx);
      const hasDy = !isNil(dy);

      const diff: Partial<PathSerializedNode> = {};
      const { d } = node;
      const absoluteArray = path2Absolute(d);

      absoluteArray.forEach((segment) => {
        const [command] = segment;
        if (command === 'M') {
          if (hasDx) {
            segment[1] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
          }
        } else if (command === 'L') {
          if (hasDx) {
            segment[1] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
          }
        } else if (command === 'H') {
          if (hasDx) {
            segment[1] += dx;
          }
        } else if (command === 'V') {
          if (hasDy) {
            segment[1] += dy;
          }
        } else if (command === 'A') {
          if (hasDx) {
            segment[6] += dx;
          }
          if (hasDy) {
            segment[7] += dy;
          }
        } else if (command === 'T') {
          if (hasDx) {
            segment[1] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
          }
        } else if (command === 'C') {
          if (hasDx) {
            segment[1] += dx;
            segment[3] += dx;
            segment[5] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
            segment[4] += dy;
            segment[6] += dy;
          }
        } else if (command === 'S') {
          if (hasDx) {
            segment[1] += dx;
            segment[3] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
            segment[4] += dy;
          }
        } else if (command === 'Q') {
          if (hasDx) {
            segment[1] += dx;
            segment[3] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
            segment[4] += dy;
          }
        }
      });

      diff.d = path2String(absoluteArray);
      this.updateNode(node, diff);
    } else if (type === 'text') {
      // TODO: Text should account for text align & baseline.
      const diff: Partial<TextSerializedNode> = {};
      if (!isNil(x)) {
        diff.x = x;
      }
      if (!isNil(y)) {
        diff.y = y;
      }
      if (!isNil(dx)) {
        diff.x = (node.x || 0) + dx;
      }
      if (!isNil(dy)) {
        diff.y = (node.y || 0) + dy;
      }
      this.updateNode(node, diff);
    }
  }

  /**
   * Delete Canvas component
   */
  destroy() {
    super.destroy();
    this.element.dispatchEvent(new CustomEvent(Event.DESTROY));
  }

  //   /**
  //    * If diff is provided, no need to calculate diffs.
  //    */
  //   updateNode(node: SerializedNode, diff?: Partial<SerializedNode>) {
  //     const entity = this.#idEntityMap.get(node.id)?.id();
  //     const nodes = this.getNodes();

  //     if (!entity) {
  //       const { cameras } = this.#canvasEntity.read(Canvas);
  //       if (cameras.length === 0) {
  //         throw new Error('No camera found');
  //       }

  //       // TODO: Support multiple cameras.
  //       const camera = cameras[0];
  //       const cameraEntityCommands = this.commands.entity(camera);

  //       // TODO: Calculate diffs and only update the changed nodes.
  //       const { entities, idEntityMap } = serializedNodesToEntities(
  //         [node],
  //         this.commands,
  //       );
  //       this.#idEntityMap.set(node.id, idEntityMap.get(node.id));

  //       this.commands.execute();

  //       entities.forEach((entity) => {
  //         // Append roots to the camera.
  //         if (!entity.has(Children)) {
  //           cameraEntityCommands.appendChild(this.commands.entity(entity));
  //         }
  //       });

  //       this.commands.execute();

  //       this.setNodes([...nodes, node]);

  //       this.element.dispatchEvent(
  //         new CustomEvent(Event.NODE_UPDATED, {
  //           detail: {
  //             node,
  //           },
  //         }),
  //       );
  //     } else {
  //       const updated = mutateElement(entity, node, diff);
  //       const index = nodes.findIndex((n) => n.id === updated.id);

  //       if (index !== -1) {
  //         nodes[index] = updated;
  //         this.setNodes(nodes);
  //       }

  //       this.element.dispatchEvent(
  //         new CustomEvent(Event.NODE_UPDATED, {
  //           detail: {
  //             node: updated,
  //           },
  //         }),
  //       );
  //     }
  //   }
}
