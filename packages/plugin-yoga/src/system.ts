import {
  System,
  Camera,
  Canvas,
  Children,
  ComputedBounds,
  FractionalIndex,
  GlobalTransform,
  Parent,
  Transform,
  Transformable,
  UI,
  ZIndex,
  getSceneRoot,
  Entity,
  API,
} from '@infinite-canvas-tutorial/ecs';
// import workerUrl from './worker.js?worker&url';
// @ts-expect-error - import.meta is only available in ES modules, but this code will run in ES module environments
import { loadYoga } from 'yoga-layout/load';

let Yoga;

interface StyleTreeNode {
  id: string;
  top?: number | string;
  left?: number | string;
  width?: number | string;
  height?: number | string;
  children: StyleTreeNode[];
}

export class YogaSystem extends System {
  private readonly canvases = this.query((q) => q.added.with(Canvas));
  private readonly cameraEntities = this.query((q) => q.current.with(Camera));

  private readonly tranforms = this.query((q) => q.added.with(Transform));

  // private readonly bounds = this.query(
  //   (q) => q.addedOrChanged.with(ComputedBounds).without(UI).trackWrites,
  // );

  private readonly bounds = this.query(
    (q) => q.addedOrChanged.and.removed.with(ComputedBounds).trackWrites,
  );

  private worker: Worker | null = null;
  private workerInited = false;
  private syncRequested = false;
  private cameras: Set<Entity> | null = null;

  /**
   * Each camera has a style tree.
   */
  private styleTrees: Map<number, StyleTreeNode> = new Map();

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(
            ComputedBounds,
            Camera,
            Canvas,
            FractionalIndex,
            Parent,
            Children,
            UI,
            ZIndex,
          )
          .read.and.using(GlobalTransform, Transform, Transformable)
          .write,
    );
  }

  async prepare() {
    Yoga = await loadYoga();
  }

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);
      const camera = api.getCamera();

      if (!this.styleTrees.has(camera.__id)) {
        this.styleTrees.set(camera.__id, {
          id: 'root',
          top: -Infinity,
          left: -Infinity,
          width: Infinity,
          height: Infinity,
          children: [],
        });
      }

      // if (!this.worker) {
      //   try {
      //     // @ts-ignore - import.meta is only available in ES modules, but this code will run in ES module environments
      //     // const workerUrl = new URL('./sam-worker.js', import.meta.url);
      //     this.worker = new Worker(workerUrl, {
      //       type: 'module',
      //     });
      //   } catch (error) {
      //     console.error('Failed to create Yoga worker:', error);
      //   }

      //   this.worker.onmessage = (event) => {
      //     const { type, data } = event.data;

      //     if (type == 'pong') {
      //       const { success } = data;
      //       if (success) {
      //         api.setAppState({ loading: false, loadingMessage: '' });
      //         this.workerInited = true;
      //       } else {
      //         api.setAppState({ loading: false, loadingMessage: '' });
      //         console.error('Failed to load Yoga');
      //       }
      //     } else if (type == 'processDone') {
      //       const { cameraId, styleTree } = data;
      //       this.updateCameraLayout(cameraId, styleTree);
      //     }
      //   };

      //   this.worker.onerror = (error) => {
      //     console.error('Worker error:', error);
      //     api.setAppState({ loading: false, loadingMessage: '' });
      //   };

      //   api.setAppState({
      //     loading: true,
      //     loadingMessage: 'Loading Yoga...',
      //   });
      //   this.worker.postMessage({ type: 'ping' });
      // }
    });

    // this.tranforms.added.forEach((transform) => {
    //   const entity = transform.entity;
    //   const camera = getSceneRoot(entity);
    //   if (camera) {
    //     this.styleTrees.get(camera.__id)?.children.push({
    //       id: entity.__id,
    //     });
    //   }
    // });

    // const cameras = new Set<Entity>();
    // this.bounds.addedOrChanged.forEach((entity) => {
    //   const camera = getSceneRoot(entity);
    //   cameras.add(camera);

    //   console.log('changed...', entity.__id)
    // });

    // const toSync = cameras.size > 0;
    // if (toSync || this.syncRequested) {
    //   if (this.workerInited) {
    //     this.syncRequested = false;
    //     this.cameras.forEach((camera) => {
    //       const { api } = camera.read(Camera).canvas.read(Canvas);
    //       const root: StyleTreeNode = {
    //         id: 'root',
    //         top: -Infinity,
    //         left: -Infinity,
    //         width: Infinity,
    //         height: Infinity,
    //         children: [],
    //       };
    //       camera.read(Parent).children.filter((child) => !child.has(UI)).forEach((child) => {
    //         constructStyleTree(api, child, root);
    //       });

    //       console.log('processing', root);
    //       this.worker.postMessage({ type: 'process', data: { styleTree: root, cameraId: camera.__id } });
    //     });
    //   } else {
    //     this.syncRequested = true;

    //     if (!this.cameras) {
    //       this.cameras = cameras;
    //     }
    //   }
    // }
    // bindingsToUpdate.forEach((binding) => {
  }

  finalize(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private updateCameraLayout(cameraId: number, styleTree: StyleTreeNode): void {
    this.cameraEntities.current.forEach((camera) => {
      if (camera.__id === cameraId) {
        const { api } = camera.read(Camera).canvas.read(Canvas);
        Object.keys(styleTree).forEach((key) => {
          const node = api.getNodeById(key);
          if (node) {
            const { x, y, width, height } = styleTree[key];
            api.updateNode(node, { x, y, width, height }, false, ['x', 'y', 'width', 'height']);
          }
        });
      }
    });
  }
}

export function constructStyleTree(api: API, entity: Entity, tree: StyleTreeNode): void {
  const node = api.getNodeByEntity(entity);
  const treeNode: StyleTreeNode = {
    ...node,
    top: node.y,
    left: node.x,
    children: [],
  };
  tree.children.push(treeNode);

  if (entity.has(Parent)) {
    entity.read(Parent).children.forEach((child) => {
      constructStyleTree(api, child, treeNode);
    });
  }
}

const YOGA_VALUE_MAPPINGS = {
  align: {
    'auto': 'ALIGN_AUTO',
    'baseline': 'ALIGN_BASELINE',
    'center': 'ALIGN_CENTER',
    'flex-end': 'ALIGN_FLEX_END',
    'flex-start': 'ALIGN_FLEX_START',
    'stretch': 'ALIGN_STRETCH'
  },
  direction: {
    'column': 'FLEX_DIRECTION_COLUMN',
    'column-reverse': 'FLEX_DIRECTION_COLUMN_REVERSE',
    'row': 'FLEX_DIRECTION_ROW',
    'row-reverse': 'FLEX_DIRECTION_ROW_REVERSE'
  },
  edge: {
    top: 'EDGE_TOP',
    right: 'EDGE_RIGHT',
    bottom: 'EDGE_BOTTOM',
    left: 'EDGE_LEFT',
  },
  justify: {
    'center': 'JUSTIFY_CENTER',
    'flex-end': 'JUSTIFY_FLEX_END',
    'flex-start': 'JUSTIFY_FLEX_START',
    'space-around': 'JUSTIFY_SPACE_AROUND',
    'space-between': 'JUSTIFY_SPACE_BETWEEN'
  },
  position: {
    'absolute': 'POSITION_TYPE_ABSOLUTE',
    'relative': 'POSITION_TYPE_RELATIVE'
  },
  wrap: {
    'nowrap': 'WRAP_NO_WRAP',
    'wrap': 'WRAP_WRAP'
  }
}

const sides = ['Top', 'Right', 'Bottom', 'Left']

// Create functions for setting each supported style property on a Yoga node
const YOGA_SETTERS = Object.create(null)
  // Simple properties
  ;[
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'aspectRatio',
    ['flexDirection', YOGA_VALUE_MAPPINGS.direction],
    'flex',
    ['flexWrap', YOGA_VALUE_MAPPINGS.wrap],
    'flexBasis',
    'flexGrow',
    'flexShrink',
    ['alignContent', YOGA_VALUE_MAPPINGS.align],
    ['alignItems', YOGA_VALUE_MAPPINGS.align],
    ['alignSelf', YOGA_VALUE_MAPPINGS.align],
    ['justifyContent', YOGA_VALUE_MAPPINGS.justify]
  ].forEach(styleProp => {
    let mapping = null
    if (Array.isArray(styleProp)) {
      mapping = styleProp[1]
      // @ts-expect-error
      styleProp = styleProp[0]
    }
    // @ts-expect-error
    const setter = `set${styleProp.charAt(0).toUpperCase()}${styleProp.substr(1)}`
    // @ts-expect-error
    YOGA_SETTERS[styleProp] = mapping ?
      (yogaNode, value) => {
        if (mapping.hasOwnProperty(value)) {
          value = Yoga[mapping[value]]
          yogaNode[setter](value)
        }
      } :
      (yogaNode, value) => {
        yogaNode[setter](value)
      }
  })

// Position-related properties
YOGA_SETTERS.position = (yogaNode, value) => {
  yogaNode.setPositionType(Yoga[YOGA_VALUE_MAPPINGS.position[value]])
}
sides.forEach(side => {
  const edgeConst = YOGA_VALUE_MAPPINGS.edge[side.toLowerCase()]
  YOGA_SETTERS[side.toLowerCase()] = (yogaNode, value) => {
    yogaNode.setPosition(Yoga[edgeConst], value)
  }
})

  // Multi-side properties
  ;[
    'margin',
    'padding',
    'border'
  ].forEach(styleProp => {
    sides.forEach(side => {
      const edgeConst = YOGA_VALUE_MAPPINGS.edge[side.toLowerCase()]
      const setter = `set${styleProp.charAt(0).toUpperCase()}${styleProp.substr(1)}`
      YOGA_SETTERS[`${styleProp}${side}`] = (yogaNode, value) => {
        yogaNode[setter](Yoga[edgeConst], value)
      }
    })
  })

function walkStyleTree(styleTree, callback) {
  callback(styleTree);
  if (styleTree.children) {
    for (let i = 0, len = styleTree.children.length; i < len; i++) {
      walkStyleTree(styleTree.children[i], callback);
    }
  }
}

function process(Yoga, styleTree, callback) {
  // Init common node config
  const yogaConfig = Yoga.Config.create();
  yogaConfig.setPointScaleFactor(0); //disable value rounding

  function populateNode(yogaNode, styleNode) {
    if (!styleNode) {
      throw new Error('Style node with no id');
    }

    for (let prop in styleNode) {
      if (styleNode.hasOwnProperty(prop)) {
        // Look for a style setter, and invoke it
        const setter = YOGA_SETTERS[prop];
        if (setter) {
          setter(yogaNode, styleNode[prop]);
        }
      }
    }

    // Recurse to children
    if (styleNode.children) {
      for (let i = 0, len = styleNode.children.length; i < len; i++) {
        const childYogaNode = Yoga.Node.createWithConfig(yogaConfig);
        populateNode(childYogaNode, styleNode.children[i]);
        yogaNode.insertChild(childYogaNode, i);
      }
    }

    // Store the Yoga node on the style object, so we can access each Yoga node's original
    // context when traversing post-layout
    styleNode.yogaNode = yogaNode;
  }

  const root = Yoga.Node.createWithConfig(yogaConfig);
  populateNode(root, styleTree);

  // Perform the layout and collect the results as a flat id-to-computed-layout map
  root.calculateLayout();
  const results = Object.create(null);
  walkStyleTree(styleTree, styleNode => {
    const { id, yogaNode } = styleNode;
    results[id] = {
      x: yogaNode.getComputedLeft(),
      y: yogaNode.getComputedTop(),
      width: yogaNode.getComputedWidth(),
      height: yogaNode.getComputedHeight()
    };
  });
  root.freeRecursive();

  callback(results);
}