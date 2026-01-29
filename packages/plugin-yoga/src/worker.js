// @ts-expect-error
import { loadYoga } from 'yoga-layout/load';

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

let Yoga;
self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'ping') {
    Yoga = await loadYoga();
    self.postMessage({
      type: 'pong',
      data: {
        success: true,
      },
    });
  } else if (type === 'process') {
    const { styleTree, cameraId } = data;
    process(Yoga, styleTree, (results) => {
      self.postMessage({
        type: 'processDone',
        data: {
          cameraId,
          styleTree: results
        },
      });
    });
  }
};