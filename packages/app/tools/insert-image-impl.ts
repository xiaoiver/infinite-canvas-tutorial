import { RectSerializedNode, svgElementsToSerializedNodes } from "@infinite-canvas-tutorial/ecs";
import { ExtendedAPI } from "@infinite-canvas-tutorial/webcomponents";
import { nanoid } from "nanoid";

const IMAGE_MARGIN = 40;

export async function insertImage(canvasApi: ExtendedAPI, input: { image: string, width: number, height: number }) {
  const { image, width, height } = input || {};
  const selectedNode = canvasApi.getNodeById(canvasApi.getAppState().layersSelected?.[0]);

  let nodeId: string | undefined;
  let suffix: string | undefined;
  if (image) {
    let center = { x: 0, y: 0 };
    if (selectedNode) {
      const { x = 0, y = 0, width: selectedNodeWidth = 0, height: selectedNodeHeight = 0 } = selectedNode as RectSerializedNode || {};
      center.x = Number(x) + Number(selectedNodeWidth) + IMAGE_MARGIN + width / 2;
      center.y = Number(y) + Number(selectedNodeHeight) / 2;
    } else {
      center = canvasApi.viewport2Canvas({
        x: canvasApi.element.clientWidth / 2,
        y: canvasApi.element.clientHeight / 2,
      });
    }

    suffix = image.split('.').pop();
    if (suffix === 'svg') {
      const svg = await fetch(image).then((res) => res.text());
      const $container = document.createElement('div');
      $container.innerHTML = svg;
      const $svg = $container.children[0] as SVGSVGElement;
      const nodes = svgElementsToSerializedNodes(
        Array.from($svg.children) as SVGElement[],
      );
      const root: RectSerializedNode = {
        id: nanoid(),
        type: 'rect',
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height
      };
      nodes.forEach((node) => {
        node.parentId = root.id;
        node.locked = true;
      });

      canvasApi.runAtNextTick(() => {
        canvasApi.updateNodes([root, ...nodes]);
        canvasApi.record();
      });
      nodeId = root.id;
    } else {
      const node = await canvasApi.createImageFromFile(image, { position: center });
      nodeId = node.id;
      canvasApi.record();
    }
  }

  return { nodeId, suffix };
}