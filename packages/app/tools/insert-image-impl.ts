import { RectSerializedNode, SerializedNode, svgElementsToSerializedNodes } from "@infinite-canvas-tutorial/ecs";
import { ExtendedAPI } from "@infinite-canvas-tutorial/webcomponents";
import { nanoid } from "nanoid";

const IMAGE_MARGIN = 40;

export async function insertImage(canvasApi: ExtendedAPI, input: { image: string, width: number, height: number }) {
  const { image, width, height } = input || {};
  const selectedNode = canvasApi.getNodeById(canvasApi.getAppState().layersSelected?.[0]);
  const { x = 0, y = 0, width: selectedNodeWidth = 0, height: selectedNodeHeight = 0 } = selectedNode as RectSerializedNode || {};
  
  let nodeId: string | undefined;
  if (image) {
    const suffix = image.split('.').pop();
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
        x: (x as number) + (selectedNodeWidth as number) + IMAGE_MARGIN,
        y: y,
        width,
        height
      };
      nodes.forEach((node) => node.parentId = root.id);

      canvasApi.runAtNextTick(() => {
        canvasApi.updateNodes([root, ...nodes]);
        canvasApi.record();
      });
      nodeId = root.id;
    } else {
      const position = { x: 0, y: 0 };
      if (selectedNode) {
        position.x = (x as number) + (selectedNodeWidth as number) + Number(width) / 2 + IMAGE_MARGIN;
        position.y = (y as number) + Number(height) / 2;
      }
      const node = await canvasApi.createImageFromFile(image, { position });
      nodeId = node.id;
      canvasApi.record();
    }
  }

  return nodeId;
}