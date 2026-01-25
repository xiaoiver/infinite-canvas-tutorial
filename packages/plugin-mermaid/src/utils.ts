import { IPointData } from "@infinite-canvas-tutorial/ecs";
import { Edge, Vertex } from "./interfaces";

export const getTransformAttr = (el: Element) => {
  const transformAttr = el.getAttribute("transform");
  const translateMatch = transformAttr?.match(
    /translate\(([ \d.-]+),\s*([\d.-]+)\)/
  );
  let transformX = 0;
  let transformY = 0;
  if (translateMatch) {
    transformX = Number(translateMatch[1]);
    transformY = Number(translateMatch[2]);
  }
  return { transformX, transformY };
};

// Convert mermaid entity codes to text e.g. "#9829;" to "♥"
export const entityCodesToText = (input: string): string => {
  // input = decodeEntities(input);
  // Append & before the pattern #(\d+); or #([a-z]+); to convert to decimal code
  // so it can be rendered as html character
  // eg #9829; => &#9829;
  const inputWithDecimalCode = input
    .replace(/#(\d+);/g, "&#$1;")
    .replace(/#([a-z]+);/g, "&$1;");

  // Render the decimal code as html character, eg &#9829; => ♥
  const element = document.createElement("textarea");
  element.innerHTML = inputWithDecimalCode;
  return element.value;
};

// Extract edge position start, end, and points (reflectionPoints)
interface EdgePositionData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  reflectionPoints: IPointData[];
}

// Compute edge postion start, end and points (reflection points)
export const computeEdgePositions = (
  pathElement: SVGPathElement,
  offset: IPointData = { x: 0, y: 0 }
): EdgePositionData => {
  // Check if the element is a path else throw an error
  if (pathElement.tagName.toLowerCase() !== "path") {
    throw new Error(
      `Invalid input: Expected an HTMLElement of tag "path", got ${pathElement.tagName}`
    );
  }

  // Get the d attribute from the path element else throw an error
  const dAttr = pathElement.getAttribute("d");
  if (!dAttr) {
    throw new Error('Path element does not contain a "d" attribute');
  }

  // Split the d attribute based on M (Move To) and L (Line To) commands
  // eg "M29.383,38.5L29.383,63.5L29.383,83.2" => ["M29.383,38.5", "L29.383,63.5", "L29.383,83.2"]
  const commands = dAttr.split(/(?=[LM])/);

  // Get the start position from the first commands element => [29.383,38.5]
  const startPosition = commands[0]
    .substring(1)
    .split(",")
    .map((coord) => parseFloat(coord));

  // Get the last position from the last commands element => [29.383,83.2]
  const endPosition = commands[commands.length - 1]
    .substring(1)
    .split(",")
    .map((coord) => parseFloat(coord));

  // compute the reflection points -> [ {x: 29.383, y: 38.5}, {x: 29.383, y: 83.2} ]
  // These includes the start and end points and also points which are not the same as the previous points
  const reflectionPoints = commands
    .map((command) => {
      const coords = command
        .substring(1)
        .split(",")
        .map((coord) => parseFloat(coord));
      return { x: coords[0], y: coords[1] };
    })
    .filter((point, index, array) => {
      // Always include the last point
      if (index === 0 || index === array.length - 1) {
        return true;
      }

      // Exclude the points which are the same as the previous point
      if (point.x === array[index - 1].x && point.y === array[index - 1].y) {
        return false;
      }

      // The below check is exclusively for second last point
      if (
        index === array.length - 2 &&
        (array[index - 1].x === point.x || array[index - 1].y === point.y)
      ) {
        const lastPoint = array[array.length - 1];

        // Get the distance between the last point and second last point using Euclidean distance formula
        const distance = Math.hypot(
          lastPoint.x - point.x,
          lastPoint.y - point.y
        );
        // Include the second last point if the distance between the
        // last point and second last point is > 20.
        // This is to ensure we have a distance for render the edge.
        // 20 seems to be a good enough distance to render the edge
        return distance > 20;
      }

      // Always include if the current point is not the same as the previous point
      return point.x !== array[index - 1].x || point.y !== array[index - 1].y;
    })
    .map((p) => {
      // Offset the point by the provided offset
      return {
        x: p.x + offset.x,
        y: p.y + offset.y,
      };
    });

  // Return the edge positions
  return {
    startX: startPosition[0] + offset.x,
    startY: startPosition[1] + offset.y,
    endX: endPosition[0] + offset.x,
    endY: endPosition[1] + offset.y,
    reflectionPoints,
  };
};

// Compute element position
export const computeElementPosition = (
  el: Element | null,
  containerEl: Element
): IPointData => {
  if (!el) {
    throw new Error("Element not found");
  }

  let root = el.parentElement?.parentElement;

  const childElement = el.childNodes[0] as SVGSVGElement;
  let childPosition = { x: 0, y: 0 };
  if (childElement) {
    const { transformX, transformY } = getTransformAttr(childElement);

    const boundingBox = childElement.getBBox();
    childPosition = {
      x:
        Number(childElement.getAttribute("x")) ||
        transformX + boundingBox.x ||
        0,
      y:
        Number(childElement.getAttribute("y")) ||
        transformY + boundingBox.y ||
        0,
    };
  }

  const { transformX, transformY } = getTransformAttr(el);
  const position = {
    x: transformX + childPosition.x,
    y: transformY + childPosition.y,
  };
  while (root && root.id !== containerEl.id) {
    if (root.classList.value === "root" && root.hasAttribute("transform")) {
      const { transformX, transformY } = getTransformAttr(root);
      position.x += transformX;
      position.y += transformY;
    }

    root = root.parentElement;
  }

  return position;
};

/**
 * Remove font awesome icons support from text
 * @see https://github.com/excalidraw/mermaid-to-excalidraw/blob/master/src/converter/helpers.ts#L67C1-L73C3
 */
const removeFontAwesomeIcons = (input: string): string => {
  const fontAwesomeRegex = /\s?(fa|fab):[a-zA-Z0-9-]+/g;
  return input.replace(fontAwesomeRegex, "");
};

/**
 * Borrow from @excalidraw/markdown-to-text
 * Parse the markdown and returns a string
 */
const removeMarkdown = (
  markdown: string,
  options: Options = {
    listUnicodeChar: "",
    stripListLeaders: true,
    gfm: true,
    useImgAltText: true,
    preserveLinks: false,
  }
) => {
  let output = markdown || "";

  // Remove horizontal rules (stripListHeaders conflict with this rule, which is why it has been moved to the top)
  output = output.replace(/^(-\s*?|\*\s*?|_\s*?){3,}\s*$/gm, "");

  try {
    if (options.stripListLeaders) {
      if (options.listUnicodeChar)
        output = output.replace(
          /^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm,
          options.listUnicodeChar + " $1"
        );
      else output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, "$1");
    }
    if (options.gfm) {
      output = output
        // Header
        .replace(/\n={2,}/g, "\n")
        // Fenced codeblocks
        .replace(/~{3}.*\n/g, "")
        // Strikethrough
        .replace(/~~/g, "")
        // Fenced codeblocks
        .replace(/`{3}.*\n/g, "");
    }
    if (options.preserveLinks) {
      // Remove inline links while preserving the links
      output = output.replace(/\[(.*?)\][\[\(](.*?)[\]\)]/g, "$1 ($2)");
    }
    output = output
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Remove setext-style headers
      .replace(/^[=\-]{2,}\s*$/g, "")
      // Remove footnotes?
      .replace(/\[\^.+?\](\: .*?$)?/g, "")
      .replace(/\s{0,2}\[.*?\]: .*?$/g, "")
      // Remove images
      .replace(/\!\[(.*?)\][\[\(].*?[\]\)]/g, options.useImgAltText ? "$1" : "")
      // Remove inline links
      .replace(/\[(.*?)\][\[\(].*?[\]\)]/g, "$1")
      // Remove blockquotes
      .replace(/^\s{0,3}>\s?/g, "")
      .replace(/(^|\n)\s{0,3}>\s?/g, "\n\n")
      // Remove reference-style links?
      .replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, "")
      // Remove atx-style headers
      .replace(
        /^(\n)?\s{0,}#{1,6}\s+| {0,}(\n)?\s{0,}#{0,} {0,}(\n)?\s{0,}$/gm,
        "$1$2$3"
      )
      // Remove emphasis (repeat the line to remove double emphasis)
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, "$2")
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, "$2")
      // Remove code blocks
      .replace(/(`{3,})(.*?)\1/gm, "$2")
      // Remove inline code
      .replace(/`(.+?)`/g, "$1")
      // Replace two or more newlines with exactly two? Not entirely sure this belongs here...
      .replace(/\n{2,}/g, "\n\n");
  } catch (e) {
    console.error(e);

    return markdown;
  }
  return output;
};

export const getText = (element: Vertex | Edge): string => {
  let text = element.text;
  if (element.labelType === "markdown") {
    text = removeMarkdown(element.text);
  }

  return removeFontAwesomeIcons(text);
};

type Options = {
  stripListLeaders?: boolean;
  listUnicodeChar: string | boolean;
  gfm?: boolean;
  useImgAltText?: boolean;
  preserveLinks?: boolean;
};
