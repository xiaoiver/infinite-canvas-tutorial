import mermaid, { MermaidConfig } from 'mermaid';
import { DiagramStyleClassDef } from 'mermaid/dist/diagram-api/types';
import { CONTAINER_STYLE_PROPERTY, Edge, LABEL_STYLE_PROPERTY, ParsedMermaidData, Vertex } from './interfaces';
import { computeEdgePositions, computeElementPosition, entityCodesToText } from './utils';
import { convertParsedMermaidDataToSerializedNodes } from './converter';

/**
 * @see https://github.com/excalidraw/mermaid-to-excalidraw/blob/master/src/constants.ts#L9
 */
export const DEFAULT_FONT_SIZE = 20;
const MERMAID_CONFIG = {
  startOnLoad: false,
  flowchart: { curve: "linear" },
  themeVariables: {
    // Multiplying by 1.25 to increase the font size by 25% and render correctly in Excalidraw
    fontSize: `${DEFAULT_FONT_SIZE * 1.25}px`,
  },
  maxEdges: 500,
  maxTextSize: 50000,
} as const;

/**
 * @see https://docs.excalidraw.com/docs/@excalidraw/mermaid-to-excalidraw/codebase/parser/
 */

export async function parseMermaidToSerializedNodes(
  definition: string,
  config?: MermaidConfig
) {
  const mermaidConfig = config || {};
  const fontSize =
    parseInt(mermaidConfig.themeVariables?.fontSize ?? "") || DEFAULT_FONT_SIZE;

  const parsedMermaidData = await parseMermaid(definition, {
    ...mermaidConfig,
    themeVariables: {
      ...mermaidConfig.themeVariables,
      // Multiplying by 1.25 to increase the font size by 25% and render correctly in Excalidraw
      fontSize: `${fontSize * 1.25}px`,
    },
  });

  // Only font size supported for excalidraw elements
  const serializedNodes = convertParsedMermaidDataToSerializedNodes(parsedMermaidData, {
    fontSize,
  });
  return serializedNodes;
}

const parseVertex = (
  data: any,
  containerEl: Element,
  classes: { [key: string]: DiagramStyleClassDef }
): Vertex | undefined => {
  // Find Vertex element
  const el: SVGSVGElement | null = containerEl.querySelector(
    `[id*="flowchart-${data.id}-"]`
  );
  if (!el) {
    return undefined;
  }

  // Check if Vertex attached with link
  let link;
  if (el.parentElement?.tagName.toLowerCase() === "a") {
    link = el.parentElement.getAttribute("xlink:href");
  }

  // Get position
  const position = computeElementPosition(
    link ? el.parentElement : el,
    containerEl
  );
  // Get dimension
  const boundingBox = el.getBBox();
  const dimension = {
    width: boundingBox.width,
    height: boundingBox.height,
  };

  // Extract style
  const labelContainerStyleText = el
    .querySelector(".label-container")
    ?.getAttribute("style");
  const labelStyleText = el.querySelector(".label")?.getAttribute("style");

  const containerStyle: Vertex["containerStyle"] = {};
  labelContainerStyleText?.split(";").forEach((property) => {
    if (!property) {
      return;
    }

    const key = property.split(":")[0].trim() as CONTAINER_STYLE_PROPERTY;
    const value = property.split(":")[1].trim();
    containerStyle[key] = value;
  });

  const labelStyle: Vertex["labelStyle"] = {};
  labelStyleText?.split(";").forEach((property) => {
    if (!property) {
      return;
    }

    const key = property.split(":")[0].trim() as LABEL_STYLE_PROPERTY;
    const value = property.split(":")[1].trim();
    labelStyle[key] = value;
  });

  if (data.classes) {
    const classDef = classes[data.classes];
    if (classDef) {
      classDef.styles?.forEach((style) => {
        const [key, value] = style.split(":");
        containerStyle[key.trim() as CONTAINER_STYLE_PROPERTY] = value.trim();
      });
      classDef.textStyles?.forEach((style) => {
        const [key, value] = style.split(":");
        labelStyle[key.trim() as LABEL_STYLE_PROPERTY] = value.trim();
      });
    }
  }
  return {
    id: data.id,
    labelType: data.labelType,
    text: entityCodesToText(data.text),
    type: data.type,
    link: link || undefined,
    ...position,
    ...dimension,
    containerStyle,
    labelStyle,
  };
};

const parseEdge = (
  data: any,
  containerEl: Element
): Edge => {
  // Find edge element
  const edge = containerEl.querySelector<SVGPathElement>(
    `[id*="${data.id}"]`
  );

  if (!edge) {
    throw new Error("Edge element not found");
  }

  // Compute edge position data
  const position = computeElementPosition(edge, containerEl);
  const edgePositionData = computeEdgePositions(edge, position);

  // Remove irrelevant properties
  data.length = undefined;

  return {
    ...data,
    ...edgePositionData,
    text: entityCodesToText(data.text),
  };
};

export async function parseMermaid(
  definition: string,
  config: Partial<MermaidConfig> = MERMAID_CONFIG
): Promise<ParsedMermaidData> {
  mermaid.initialize({ ...MERMAID_CONFIG, ...config });
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(definition);

  // Render the SVG diagram
  const { svg } = await mermaid.render("mermaid-to-excalidraw", definition);

  // Append Svg to DOM
  const svgContainer = document.createElement("div");
  svgContainer.setAttribute(
    "style",
    `opacity: 0; position: relative; z-index: -1;`
  );
  svgContainer.innerHTML = svg;
  svgContainer.id = "mermaid-diagram";
  document.body.appendChild(svgContainer);

  let data;
  switch (diagram.type) {
    case "flowchart-v2": {
      data = parseMermaidFlowChartDiagram(diagram.parser, svgContainer);
      break;
    }
    default: {
      throw new Error(`Unsupported diagram type: ${diagram.type}`);
    }
  }

  svgContainer.remove();
  return data;
}

/**
 * @see https://github.com/excalidraw/mermaid-to-excalidraw/blob/master/src/parser/flowchart.ts#L238
 */
function parseMermaidFlowChartDiagram(diagram: any, containerEl: Element): ParsedMermaidData {
  // This does some cleanup and initialization making sure
  // diagram is parsed correctly. Useful when multiple diagrams are
  // parsed together one after another, eg in playground
  // https://github.com/mermaid-js/mermaid/blob/e561cbd3be2a93b8bedfa4839484966faad92ccf/packages/mermaid/src/Diagram.ts#L43

  const mermaidParser = (diagram.parser as any).yy;
  const vertices = mermaidParser.getVertices() as Map<string, Vertex>;
  const classes = mermaidParser.getClasses();
  vertices.forEach((vertex, id) => {
    vertices[id] = parseVertex(vertex, containerEl, classes);
  });

  // Track the count of edges based on the edge id
  const edges = mermaidParser
    .getEdges().filter((edge: any) => containerEl.querySelector(`[id*="${edge.id}"]`)).map((data: any) => parseEdge(data, containerEl));

  return {
    type: "flowchart",
    // subGraphs,
    vertices,
    edges,
  };
}

