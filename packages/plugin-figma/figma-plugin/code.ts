/**
 * Main thread of the "Infinite Canvas Import" Figma plugin.
 *
 * Runs inside Figma's sandbox and replays a `FigmaScene` payload (produced by
 * `serializedNodesToFigmaScene` in the parent package) into the current
 * document using the Figma Plugin API — the `.ic` → Figma export direction
 * that the read-only REST API cannot perform.
 *
 * This file targets the Figma Plugin typings (`@figma/plugin-typings`) and is
 * intended to be compiled separately from the npm package (it is shipped as
 * source under `figma-plugin/`). The scene types are duplicated locally so the
 * plugin has no import dependency on the package build output.
 */

interface FigmaSceneColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FigmaScenePaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'IMAGE';
  color?: FigmaSceneColor;
  opacity?: number;
  imageUrl?: string;
}

interface FigmaSceneNode {
  id: string;
  type: 'FRAME' | 'GROUP' | 'RECTANGLE' | 'ELLIPSE' | 'VECTOR' | 'TEXT';
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  cornerRadius?: number;
  fills?: FigmaScenePaint[];
  strokes?: FigmaScenePaint[];
  strokeWeight?: number;
  characters?: string;
  fontSize?: number;
  fontFamily?: string;
  vectorPath?: string;
  children?: FigmaSceneNode[];
}

interface FigmaScene {
  type: 'infinite-canvas-figma-scene';
  version: 1;
  source?: string;
  nodes: FigmaSceneNode[];
}

function toSolidPaints(paints?: FigmaScenePaint[]): SolidPaint[] {
  if (!paints) {
    return [];
  }
  const out: SolidPaint[] = [];
  for (const paint of paints) {
    if (paint.type === 'SOLID' && paint.color) {
      out.push({
        type: 'SOLID',
        color: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
        opacity: paint.opacity != null ? paint.opacity : paint.color.a,
      });
    }
  }
  return out;
}

async function createSceneNode(node: FigmaSceneNode): Promise<SceneNode | null> {
  let created: SceneNode | null = null;

  switch (node.type) {
    case 'RECTANGLE': {
      const rect = figma.createRectangle();
      rect.resize(Math.max(node.width, 0.01), Math.max(node.height, 0.01));
      if (node.cornerRadius != null) {
        rect.cornerRadius = node.cornerRadius;
      }
      rect.fills = toSolidPaints(node.fills);
      rect.strokes = toSolidPaints(node.strokes);
      if (node.strokeWeight != null) {
        rect.strokeWeight = node.strokeWeight;
      }
      created = rect;
      break;
    }
    case 'ELLIPSE': {
      const ellipse = figma.createEllipse();
      ellipse.resize(Math.max(node.width, 0.01), Math.max(node.height, 0.01));
      ellipse.fills = toSolidPaints(node.fills);
      ellipse.strokes = toSolidPaints(node.strokes);
      if (node.strokeWeight != null) {
        ellipse.strokeWeight = node.strokeWeight;
      }
      created = ellipse;
      break;
    }
    case 'TEXT': {
      const text = figma.createText();
      try {
        await figma.loadFontAsync(text.fontName as FontName);
      } catch (e) {
        // The node's default font may be unavailable in this Figma instance;
        // fall back to a font that ships with Figma.
        console.warn('[figma] falling back to Inter Regular:', e);
        const fallback: FontName = { family: 'Inter', style: 'Regular' };
        await figma.loadFontAsync(fallback);
        text.fontName = fallback;
      }
      text.characters = node.characters || '';
      if (node.fontSize != null) {
        text.fontSize = node.fontSize;
      }
      const fills = toSolidPaints(node.fills);
      if (fills.length > 0) {
        text.fills = fills;
      }
      created = text;
      break;
    }
    case 'VECTOR': {
      const vector = figma.createVector();
      vector.resize(Math.max(node.width, 0.01), Math.max(node.height, 0.01));
      if (node.vectorPath) {
        vector.vectorPaths = [
          { windingRule: 'NONZERO', data: node.vectorPath },
        ];
      }
      vector.fills = toSolidPaints(node.fills);
      vector.strokes = toSolidPaints(node.strokes);
      if (node.strokeWeight != null) {
        vector.strokeWeight = node.strokeWeight;
      }
      created = vector;
      break;
    }
    case 'FRAME':
    case 'GROUP': {
      const frame = figma.createFrame();
      frame.resize(Math.max(node.width, 0.01), Math.max(node.height, 0.01));
      const fills = toSolidPaints(node.fills);
      frame.fills = fills.length > 0 ? fills : [];
      if (node.children) {
        for (const child of node.children) {
          const childNode = await createSceneNode(child);
          if (childNode) {
            frame.appendChild(childNode);
            // Child coordinates are absolute in the scene; make them relative.
            childNode.x = child.x - node.x;
            childNode.y = child.y - node.y;
          }
        }
      }
      created = frame;
      break;
    }
    default:
      created = null;
      break;
  }

  if (created) {
    created.x = node.x;
    created.y = node.y;
    if (node.name) {
      created.name = node.name;
    }
    if (node.rotation != null && 'rotation' in created) {
      (created as LayoutMixin).rotation = (node.rotation * 180) / Math.PI;
    }
    if (node.opacity != null && 'opacity' in created) {
      (created as BlendMixin).opacity = node.opacity;
    }
    if (node.visible === false) {
      created.visible = false;
    }
  }
  return created;
}

async function importScene(scene: FigmaScene): Promise<number> {
  let count = 0;
  const created: SceneNode[] = [];
  for (const node of scene.nodes) {
    const sceneNode = await createSceneNode(node);
    if (sceneNode) {
      figma.currentPage.appendChild(sceneNode);
      created.push(sceneNode);
      count += 1;
    }
  }
  if (created.length > 0) {
    figma.currentPage.selection = created;
    figma.viewport.scrollAndZoomIntoView(created);
  }
  return count;
}

figma.showUI(__html__, { width: 360, height: 360 });

figma.ui.onmessage = async (msg: { type: string; scene?: FigmaScene }) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }
  if (msg.type === 'import' && msg.scene) {
    if (msg.scene.type !== 'infinite-canvas-figma-scene') {
      figma.ui.postMessage({
        type: 'error',
        message: 'Not an Infinite Canvas scene payload.',
      });
      return;
    }
    try {
      const count = await importScene(msg.scene);
      figma.ui.postMessage({ type: 'done', count });
    } catch (e) {
      figma.ui.postMessage({
        type: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
};
