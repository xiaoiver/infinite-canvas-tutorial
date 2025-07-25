interface Item {
  id: string;
  name?: string;
  label?: string;
  preH?: number;
  preV?: number;
  hgap?: number;
  vgap?: number;
  height?: number;
  width?: number;
  collapsed?: boolean;
  isRoot?: boolean;
  children: Item[];
}

interface Options {
  direction?: 'H' | 'V';
  getId: (d: Item) => string;
  getPreH: (d: Item) => number;
  getPreV: (d: Item) => number;
  getChildren: (d: Item) => Item[];
  getHeight: (d: Item) => number;
  getWidth: (d: Item) => number;
  getHGap: (d: Item) => number;
  getVGap: (d: Item) => number;
  getSubTreeSep: (d: Item) => number;
}

const PEM = 18;
const DEFAULT_HEIGHT = PEM * 2;
const DEFAULT_GAP = PEM;

const DEFAULT_OPTIONS: Partial<Options> = {
  getId(d) {
    return d.id || d.name;
  },
  getPreH(d) {
    return d.preH || 0;
  },
  getPreV(d) {
    return d.preV || 0;
  },
  getHGap(d) {
    return d.hgap || DEFAULT_GAP;
  },
  getVGap(d) {
    return d.vgap || DEFAULT_GAP;
  },
  getChildren(d) {
    return d.children;
  },
  getHeight(d) {
    return d.height || DEFAULT_HEIGHT;
  },
  getWidth(d) {
    const label = d.label || ' ';
    return d.width || label.split('').length * PEM; // FIXME DO NOT get width like this
  },
};

export class Node {
  vgap: number;
  hgap: number;
  data: any;
  preH: number;
  preV: number;
  width: number;
  height: number;
  children: Node[];
  parent: Node;
  depth: number;
  id: string;
  x: number;
  y: number;

  constructor(data: Item, options: Partial<Options>) {
    this.vgap = this.hgap = 0;
    this.data = data;
    /*
     * Gaps: filling space between nodes
     * (x, y) ----------------------
     * |            vgap            |
     * |    --------------------    h
     * | h |                    |   e
     * | g |                    |   i
     * | a |                    |   g
     * | p |                    |   h
     * |   ---------------------    t
     * |                            |
     *  -----------width------------
     */
    const hgap = options.getHGap(data);
    const vgap = options.getVGap(data);
    this.preH = options.getPreH(data);
    this.preV = options.getPreV(data);
    this.width = options.getWidth(data);
    this.height = options.getHeight(data);
    this.width += this.preH;
    this.height += this.preV;
    this.id = options.getId(data);
    this.x = this.y = 0;
    this.depth = 0;
    if (!this.children) {
      this.children = [];
    }
    this.addGap(hgap, vgap);
  }

  isRoot() {
    return this.depth === 0;
  }

  isLeaf() {
    return this.children.length === 0;
  }

  addGap(hgap: number, vgap: number) {
    this.hgap += hgap;
    this.vgap += vgap;
    this.width += 2 * hgap;
    this.height += 2 * vgap;
  }

  eachNode(callback) {
    // Depth First traverse
    let nodes = [this];
    let current;
    while ((current = nodes.shift())) {
      callback(current);
      nodes = current.children.concat(nodes);
    }
  }

  DFTraverse(callback) {
    // Depth First traverse
    this.eachNode(callback);
  }

  BFTraverse(callback) {
    // Breadth First traverse
    let nodes = [this];
    let current;
    while ((current = nodes.shift())) {
      callback(current);
      nodes = nodes.concat(current.children);
    }
  }

  getBoundingBox() {
    // BBox for just one tree node
    const bb = {
      left: Number.MAX_VALUE,
      top: Number.MAX_VALUE,
      width: 0,
      height: 0,
    };
    this.eachNode((node) => {
      bb.left = Math.min(bb.left, node.x);
      bb.top = Math.min(bb.top, node.y);
      bb.width = Math.max(bb.width, node.x + node.width);
      bb.height = Math.max(bb.height, node.y + node.height);
    });
    return bb;
  }

  // translate
  translate(tx = 0, ty = 0) {
    this.eachNode((node) => {
      node.x += tx;
      node.y += ty;
      node.x += node.preH;
      node.y += node.preV;
    });
  }

  right2left() {
    const bb = this.getBoundingBox();
    this.eachNode((node) => {
      node.x = node.x - (node.x - bb.left) * 2 - node.width;
      // node.x = - node.x;
    });
    this.translate(bb.width, 0);
  }

  bottom2top() {
    const bb = this.getBoundingBox();
    this.eachNode((node) => {
      node.y = node.y - (node.y - bb.top) * 2 - node.height;
      // node.y = - node.y;
    });
    this.translate(0, bb.height);
  }
}

function hierarchy(
  data: Item,
  options: Partial<Options> = {},
  isolated = false,
) {
  options = Object.assign({}, DEFAULT_OPTIONS, options);
  const root = new Node(data, options);
  const nodes = [root];
  let node;
  if (!isolated && !data.collapsed) {
    while ((node = nodes.shift())) {
      if (!node.data.collapsed) {
        const children = options.getChildren(node.data);
        const length = children ? children.length : 0;
        node.children = new Array(length);
        if (children && length) {
          for (let i = 0; i < length; i++) {
            const child = new Node(children[i], options);
            node.children[i] = child;
            nodes.push(child);
            child.parent = node;
            child.depth = node.depth + 1;
          }
        }
      }
    }
  }
  return root;
}

class MindmapLayout {
  options: any;
  rootNode: Node;

  constructor(root: Item, options: Partial<Options> = {}) {
    this.options = options;
    this.rootNode = hierarchy(root, options);
  }

  execute() {
    return doTreeLayout(this.rootNode, this.options, mindmap);
  }
}

export function mindmapLayout(
  root: Item,
  options: Partial<Options> = {},
): Node {
  options = Object.assign({}, DEFAULT_OPTIONS, options);
  return new MindmapLayout(root, options).execute();
}

function secondWalk(node, options) {
  let totalHeight = 0;
  if (!node.children.length) {
    totalHeight = node.height;
  } else {
    node.children.forEach((c) => {
      totalHeight += secondWalk(c, options);
    });
  }
  node._subTreeSep = options.getSubTreeSep(node.data);
  node.totalHeight = Math.max(node.height, totalHeight) + 2 * node._subTreeSep;
  return node.totalHeight;
}

function thirdWalk(node) {
  const children = node.children;
  const len = children.length;
  if (len) {
    children.forEach((c) => {
      thirdWalk(c);
    });
    const first = children[0];
    const last = children[len - 1];
    const childrenHeight = last.y - first.y + last.height;
    let childrenTotalHeight = 0;
    children.forEach((child) => {
      childrenTotalHeight += child.totalHeight;
    });
    if (childrenHeight > node.height) {
      // 当子节点总高度大于父节点高度
      node.y = first.y + childrenHeight / 2 - node.height / 2;
    } else if (children.length !== 1 || node.height > childrenTotalHeight) {
      // 多于一个子节点或者父节点大于所有子节点的总高度
      const offset = node.y + (node.height - childrenHeight) / 2 - first.y;
      children.forEach((c) => {
        c.translate(0, offset);
      });
    } else {
      // 只有一个子节点
      node.y =
        (first.y + first.height / 2 + last.y + last.height / 2) / 2 -
        node.height / 2;
    }
  }
}

function mindmap(root, options = {}) {
  options = Object.assign(
    {},
    {
      getSubTreeSep() {
        return 0;
      },
    },
    options,
  );
  root.parent = {
    x: 0,
    width: 0,
    height: 0,
    y: 0,
  };
  // first walk
  root.BFTraverse((node) => {
    node.x = node.parent.x + node.parent.width; // simply get x
  });
  root.parent = null;
  // second walk
  secondWalk(root, options); // assign sub tree totalHeight
  // adjusting
  // separating nodes
  root.startY = 0;
  root.y = root.totalHeight / 2 - root.height / 2;
  root.eachNode((node) => {
    const children = node.children;
    const len = children.length;
    if (len) {
      const first = children[0];
      first.startY = node.startY + node._subTreeSep;
      if (len === 1) {
        first.y = node.y + node.height / 2 - first.height / 2;
      } else {
        first.y = first.startY + first.totalHeight / 2 - first.height / 2;
        for (let i = 1; i < len; i++) {
          const c = children[i];
          c.startY = children[i - 1].startY + children[i - 1].totalHeight;
          c.y = c.startY + c.totalHeight / 2 - c.height / 2;
        }
      }
    }
  });

  // third walk
  thirdWalk(root);
}

function separateTree(root, options) {
  // separate into left and right trees
  const left = hierarchy(root.data, options, true); // root only
  const right = hierarchy(root.data, options, true); // root only
  // automatically
  const treeSize = root.children.length;
  const rightTreeSize = Math.round(treeSize / 2);
  // separate left and right tree by meta data
  const getSide =
    options.getSide ||
    ((child, index) => {
      if (index < rightTreeSize) {
        return 'right';
      }
      return 'left';
    });
  for (let i = 0; i < treeSize; i++) {
    const child = root.children[i];
    const side = getSide(child, i);
    if (side === 'right') {
      right.children.push(child);
    } else {
      left.children.push(child);
    }
  }
  left.eachNode((node) => {
    if (!node.isRoot()) {
      node.side = 'left';
    }
  });
  right.eachNode((node) => {
    if (!node.isRoot()) {
      node.side = 'right';
    }
  });
  return {
    left,
    right,
  };
}

const VALID_DIRECTIONS = [
  'LR', // left to right
  'RL', // right to left
  'TB', // top to bottom
  'BT', // bottom to top
  'H', // horizontal
  'V', // vertical
];
const HORIZONTAL_DIRECTIONS = ['LR', 'RL', 'H'];
const isHorizontal = (direction) =>
  HORIZONTAL_DIRECTIONS.indexOf(direction) > -1;
const DEFAULT_DIRECTION = VALID_DIRECTIONS[0];
function doTreeLayout(root, options, layoutAlgrithm) {
  const direction = options.direction || DEFAULT_DIRECTION;
  options.isHorizontal = isHorizontal(direction);
  if (direction && VALID_DIRECTIONS.indexOf(direction) === -1) {
    throw new TypeError(`Invalid direction: ${direction}`);
  }

  if (direction === VALID_DIRECTIONS[0]) {
    // LR
    layoutAlgrithm(root, options);
  } else if (direction === VALID_DIRECTIONS[1]) {
    // RL
    layoutAlgrithm(root, options);
    root.right2left();
  } else if (direction === VALID_DIRECTIONS[2]) {
    // TB
    layoutAlgrithm(root, options);
  } else if (direction === VALID_DIRECTIONS[3]) {
    // BT
    layoutAlgrithm(root, options);
    root.bottom2top();
  } else if (
    direction === VALID_DIRECTIONS[4] ||
    direction === VALID_DIRECTIONS[5]
  ) {
    // H or V
    // separate into left and right trees
    const { left, right } = separateTree(root, options);
    // do layout for left and right trees
    layoutAlgrithm(left, options);
    layoutAlgrithm(right, options);
    options.isHorizontal ? left.right2left() : left.bottom2top();
    // combine left and right trees
    right.translate(left.x - right.x, left.y - right.y);
    // translate root
    root.x = left.x;
    root.y = right.y;
    const bb = root.getBoundingBox();
    if (options.isHorizontal) {
      if (bb.top < 0) {
        root.translate(0, -bb.top);
      }
    } else {
      if (bb.left < 0) {
        root.translate(-bb.left, 0);
      }
    }
  }
  // fixed root position, default value is true
  let fixedRoot = options.fixedRoot;
  if (fixedRoot === undefined) fixedRoot = true;
  if (fixedRoot) {
    root.translate(
      -(root.x + root.width / 2 + root.hgap),
      -(root.y + root.height / 2 + root.vgap),
    );
  }

  reassignXYIfRadial(root, options);

  return root;
}

function reassignXYIfRadial(root, options) {
  if (options.radial) {
    const [rScale, radScale] = options.isHorizontal ? ['x', 'y'] : ['y', 'x'];

    const min = { x: Infinity, y: Infinity };
    const max = { x: -Infinity, y: -Infinity };

    let count = 0;
    root.DFTraverse((node) => {
      count++;
      const { x, y } = node;
      min.x = Math.min(min.x, x);
      min.y = Math.min(min.y, y);
      max.x = Math.max(max.x, x);
      max.y = Math.max(max.y, y);
    });

    const radDiff = max[radScale] - min[radScale];
    if (radDiff === 0) return;

    const avgRad = (Math.PI * 2) / count;
    root.DFTraverse((node) => {
      const rad =
        ((node[radScale] - min[radScale]) / radDiff) * (Math.PI * 2 - avgRad) +
        avgRad;
      const r = node[rScale] - root[rScale];
      node.x = Math.cos(rad) * r;
      node.y = Math.sin(rad) * r;
    });
  }
}

function measureText(text: string, fontSize: number) {
  const $canvas = document.createElement('canvas');
  const ctx = $canvas.getContext('2d');
  ctx!.font = `${fontSize}px Arial, monospace`;
  return ctx!.measureText(text).width;
}

const palette = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];

export function createMindmap(root): string {
  let svg = '';

  const rootNode = mindmapLayout(root, {
    direction: 'H',
    getHeight(d) {
      if (d.isRoot) {
        return 60;
      }
      return 30;
    },
    getWidth(d) {
      const padding = d.isRoot ? 40 : 30;
      const fontSize = d.isRoot ? 24 : 16;
      return measureText(d.id, fontSize) + padding;
    },
    getVGap: () => 6,
    getHGap: () => 60,
    getSubTreeSep(d) {
      if (!d.children || !d.children.length) {
        return 0;
      }
      return 20;
    },
  });

  // 计算边界框以设置合适的 viewBox
  const bb = rootNode.getBoundingBox();
  const padding = 50; // 添加一些内边距
  const viewBoxX = bb.left - padding;
  const viewBoxY = bb.top - padding;
  const viewBoxWidth = bb.width - bb.left + padding * 2;
  const viewBoxHeight = bb.height - bb.top + padding * 2;

  // 设置 SVG 的 width 和 height 属性
  const svgWidth = Math.max(400, viewBoxWidth); // 最小宽度 400px
  const svgHeight = Math.max(400, viewBoxHeight); // 最小高度 400px

  svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg">\n`;
  const drawLink = (n: Node, c: Node) => {
    let beginNode = n;
    let endNode = c;
    let side = 'right';
    if (n.x > c.x) {
      side = 'left';
      beginNode = c;
      endNode = n;
    }
    let beginX = Math.round(beginNode.x + beginNode.width - beginNode.hgap);
    let beginY = Math.round(beginNode.y + beginNode.height / 2);
    let endX = Math.round(endNode.x + endNode.hgap);
    let endY = Math.round(endNode.y + endNode.height / 2);
    if (beginNode.isRoot()) {
      beginX = Math.round(beginNode.x + beginNode.width / 2);
      beginY = Math.round(beginNode.y + beginNode.height / 2);
    }
    if (endNode.isRoot()) {
      endX = Math.round(endNode.x + endNode.width / 2);
      endY = Math.round(endNode.y + endNode.height / 2);
    }
    svg += `<path d="${
      (side === 'right'
        ? `M${beginX},${beginY} `
        : `M${beginNode.x + beginNode.hgap},${beginY} L${beginX},${beginY} `) +
      `C${Math.round(
        beginX + (beginNode.hgap + endNode.hgap) / 2,
      )},${beginY} ${Math.round(
        endX - (beginNode.hgap + endNode.hgap) / 2,
      )},${endY} ${endX},${endY}` +
      (side === 'right'
        ? `L${endX + endNode.width - endNode.hgap * 2},${endY}`
        : '')
    }" stroke="${c.data.color}" stroke-width="4" fill="none" />`;
  };

  const drawNode = (node: Node) => {
    const origin = node.data;
    const fontSize = origin.isRoot ? 24 : 16;
    // const color = randomColor();
    const x = Math.round(node.x + node.hgap);
    const y = Math.round(node.y + node.vgap);
    const width = Math.round(node.width - node.hgap * 2);
    const height = Math.round(node.height - node.vgap * 2);
    const text = `<text x="${x}" y="${
      y + 8
    }" fill="black" font-family="Arial, monospace" font-size="${fontSize}">${
      origin.id
    }</text>`;

    if (origin.isRoot) {
      svg += `<g transform="translate(${x}, ${y})">
        <rect x="0" y="0" width="${width}" height="${height}" fill="grey" />
        <text x="${width / 2}" y="${
        height / 2
      }" fill="black" font-family="Arial, monospace" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${
        origin.id
      }</text>
      </g>`;
    } else {
      svg += text;
    }
  };

  let index = 0;
  rootNode.eachNode((node: Node) => {
    if (node.depth === 1) {
      node.data.color = palette[index % palette.length];
      index++;
    }
    node.children.forEach((child: Node) => {
      child.data.color = node.data.color;
    });
  });

  rootNode.eachNode((node: Node) => {
    node.children.forEach((child: Node) => {
      drawLink(node, child);
    });
    drawNode(node);
  });
  svg += '</svg>';

  return svg;
}
