import { co, Entity, System } from '@lastolivegames/becsy';
import {
  Camera,
  Canvas,
  CheckboardStyle,
  Children,
  Circle,
  ComputedBounds,
  ComputedCamera,
  DropShadow,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FractionalIndex,
  Grid,
  InnerShadow,
  Name,
  Opacity,
  Parent,
  Path,
  Polyline,
  Rect,
  Screenshot,
  Stroke,
  Text,
  Theme,
  Transform,
  UI,
  VectorScreenshotRequest,
  Visibility,
} from '../components';
import { DOMAdapter } from '../environment';
import {
  createSVGElement,
  entityToSerializedNodes,
  serializeNodesToSVGElements,
} from '../utils';

interface SVGOptions {
  grid: boolean;
}

export class ExportSVG extends System {
  private readonly vectorScreenshotRequests = this.query((q) =>
    q.added.with(VectorScreenshotRequest),
  );

  @co private *setScreenshotTrigger(
    canvas: Entity,
    dataURL: string,
    download: boolean,
  ): Generator {
    if (!canvas.has(Screenshot)) {
      canvas.add(Screenshot);
    }

    const screenshot = canvas.write(Screenshot);

    Object.assign(screenshot, { dataURL, canvas, download });
    yield;

    canvas.remove(Screenshot);
    canvas.remove(VectorScreenshotRequest);
  }

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(
            Canvas,
            Theme,
            Grid,
            Camera,
            UI,
            Name,
            Parent,
            Children,
            Circle,
            Ellipse,
            Rect,
            Polyline,
            Path,
            Text,
            Stroke,
            Opacity,
            Transform,
            FillSolid,
            FillGradient,
            FillPattern,
            FillImage,
            DropShadow,
            InnerShadow,
            Visibility,
            FractionalIndex,
            ComputedBounds,
            ComputedCamera,
          )
          .read.and.using(Screenshot, VectorScreenshotRequest).write,
    );
  }

  execute(): void {
    this.vectorScreenshotRequests.added.forEach((vectorScreenshotRequest) => {
      const { canvas, grid, download } = vectorScreenshotRequest.read(
        VectorScreenshotRequest,
      );

      this.setScreenshotTrigger(
        canvas,
        this.toSVGDataURL(canvas, { grid }),
        download,
      );
    });
  }

  private toSVG(canvas: Entity, options: Partial<SVGOptions> = {}) {
    const { grid: gridEnabled } = options;
    const { width, height, cameras } = canvas.read(Canvas);
    const { mode, colors } = canvas.read(Theme);
    const { checkboardStyle } = canvas.read(Grid);
    const { grid: gridColor, background: backgroundColor } = colors[mode];

    const $namespace = createSVGElement('svg');
    $namespace.setAttribute('width', `${width}`);
    $namespace.setAttribute('height', `${height}`);
    // @see https://www.geeksforgeeks.org/how-to-set-the-svg-background-color/
    $namespace.setAttribute('style', `background-color: ${backgroundColor}`);

    {
      // Calculate viewBox according to the camera's transform.
      const { x, y, zoom } = cameras[0].read(ComputedCamera);
      $namespace.setAttribute(
        'viewBox',
        `${x} ${y} ${width / zoom} ${height / zoom}`,
      );
    }

    if (gridEnabled) {
      if (checkboardStyle === CheckboardStyle.GRID) {
        this.drawLinesGrid($namespace, gridColor);
      } else if (checkboardStyle === CheckboardStyle.DOTS) {
        this.drawDotsGrid($namespace, gridColor);
      }
    }

    serializeNodesToSVGElements(
      cameras[0]
        .read(Parent)
        .children.map((child) =>
          entityToSerializedNodes(child, (entity) => !entity.has(UI)),
        )
        .flat(),
    ).forEach((element) => {
      $namespace.appendChild(element);
    });
    return $namespace;
  }

  private toSVGDataURL(entity: Entity, options: Partial<SVGOptions> = {}) {
    const $namespace = this.toSVG(entity, options);
    const svgDocType = DOMAdapter.get()
      .getDocument()
      .implementation.createDocumentType(
        'svg',
        '-//W3C//DTD SVG 1.1//EN',
        'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd',
      );
    const svgDoc = DOMAdapter.get()
      .getDocument()
      .implementation.createDocument(
        'http://www.w3.org/2000/svg',
        'svg',
        svgDocType,
      );
    svgDoc.replaceChild($namespace, svgDoc.documentElement);
    return `data:image/svg+xml;charset=utf8,${encodeURIComponent(
      DOMAdapter.get().getXMLSerializer().serializeToString(svgDoc),
    )}`;
  }

  private drawLinesGrid($namespace: SVGElement, gridColor: string) {
    const $defs = createSVGElement('defs');
    $namespace.appendChild($defs);
    const $pattern = createSVGElement('pattern');
    $pattern.setAttribute('id', 'small-grid');
    $pattern.setAttribute('width', '10');
    $pattern.setAttribute('height', '10');
    $pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const $path = createSVGElement('path');
    $path.setAttribute('d', 'M 10 0 L 0 0 0 10');
    $path.setAttribute('fill', 'none');

    $path.setAttribute('stroke', gridColor);
    $path.setAttribute('stroke-width', '1');
    $pattern.appendChild($path);

    const $pattern2 = createSVGElement('pattern');
    $pattern2.setAttribute('id', 'grid');
    $pattern2.setAttribute('width', '100');
    $pattern2.setAttribute('height', '100');
    $pattern2.setAttribute('patternUnits', 'userSpaceOnUse');
    const $rect = createSVGElement('rect');
    $rect.setAttribute('width', '100');
    $rect.setAttribute('height', '100');
    $rect.setAttribute('fill', 'url(#small-grid)');
    $pattern2.appendChild($rect);

    const $path2 = createSVGElement('path');
    $path2.setAttribute('d', 'M 100 0 L 0 0 0 100');
    $path2.setAttribute('fill', 'none');
    $path2.setAttribute('stroke', gridColor);
    $path2.setAttribute('stroke-width', '2');
    $pattern2.appendChild($path2);

    $defs.appendChild($pattern);
    $defs.appendChild($pattern2);

    const $rect2 = createSVGElement('rect');
    $rect2.setAttribute('width', '100%');
    $rect2.setAttribute('height', '100%');
    $rect2.setAttribute('fill', 'url(#grid)');
    $namespace.appendChild($rect2);
  }

  private drawDotsGrid($namespace: SVGElement, gridColor: string) {
    const $defs = createSVGElement('defs');
    $namespace.appendChild($defs);
    const $circleTL = createSVGElement('circle');
    $circleTL.setAttribute('id', 'dot-tl');
    $circleTL.setAttribute('cx', '0');
    $circleTL.setAttribute('cy', '0');
    $circleTL.setAttribute('r', '2');
    $circleTL.setAttribute('fill', gridColor);

    const $circleTR = $circleTL.cloneNode() as SVGCircleElement;
    const $circleBL = $circleTL.cloneNode() as SVGCircleElement;
    const $circleBR = $circleTL.cloneNode() as SVGCircleElement;
    $circleTR.setAttribute('id', 'dot-tr');
    $circleTR.setAttribute('cx', '20');
    $circleBL.setAttribute('id', 'dot-bl');
    $circleBL.setAttribute('cy', '20');
    $circleBR.setAttribute('id', 'dot-br');
    $circleBR.setAttribute('cx', '20');
    $circleBR.setAttribute('cy', '20');

    $defs.appendChild($circleTL);
    $defs.appendChild($circleTR);
    $defs.appendChild($circleBL);
    $defs.appendChild($circleBR);

    const $pattern = createSVGElement('pattern');
    $pattern.setAttribute('id', 'dots-grid');
    $pattern.setAttribute('width', '20');
    $pattern.setAttribute('height', '20');
    $pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const $useBL = createSVGElement('use');
    $useBL.setAttribute('xlink:href', '#dot-bl');
    const $useBR = createSVGElement('use');
    $useBR.setAttribute('xlink:href', '#dot-br');
    const $useTL = createSVGElement('use');
    $useTL.setAttribute('xlink:href', '#dot-tl');
    const $useTR = createSVGElement('use');
    $useTR.setAttribute('xlink:href', '#dot-tr');
    $pattern.appendChild($useBL);
    $pattern.appendChild($useBR);
    $pattern.appendChild($useTL);
    $pattern.appendChild($useTR);
    $defs.appendChild($pattern);

    const $rect = createSVGElement('rect');
    $rect.setAttribute('width', '100%');
    $rect.setAttribute('height', '100%');
    $rect.setAttribute('fill', 'url(#dots-grid)');
    $namespace.appendChild($rect);
  }
}
