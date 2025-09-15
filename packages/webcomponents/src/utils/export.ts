import {
  MIME_TYPES,
  IMAGE_MIME_TYPES,
  SerializedNode,
  serializeNodesToSVGElements,
  createSVGElement,
  toSVG,
  API,
} from '@infinite-canvas-tutorial/ecs';
import { fileSave } from './filesystem';

export const exportSVG = async (
  api: API,
  nodes: SerializedNode[],
  padding = 0,
) => {
  api.runAtNextTick(() => {
    // Get bounds of nodes.
    const bounds = api.getBounds(nodes);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    const $svg = createSVGElement('svg');
    $svg.setAttribute('width', `${width}`);
    $svg.setAttribute('height', `${height}`);

    // add padding with viewBox
    $svg.setAttribute(
      'viewBox',
      `${bounds.minX - padding} ${bounds.minY - padding} ${
        width + padding * 2
      } ${height + padding * 2}`,
    );

    serializeNodesToSVGElements(nodes).forEach((element) => {
      $svg.appendChild(element);
    });

    fileSave(
      new Blob([toSVG($svg)], {
        type: MIME_TYPES.svg,
      }),
      {
        description: 'Export to SVG',
        name: 'infinite-canvas-tutorial',
        extension: 'svg',
        mimeTypes: [IMAGE_MIME_TYPES.svg],
        fileHandle: null,
      },
    );
  });
};

export const exportCanvas = () => {
  // TODO: render to offscreen canvas
  // return fileSave(blob, {
  //   description: "Export to PNG",
  //   name: 'infinite-canvas-tutorial',
  //   extension: "png",
  //   mimeTypes: [IMAGE_MIME_TYPES.png],
  //   fileHandle: null,
  // });
};
