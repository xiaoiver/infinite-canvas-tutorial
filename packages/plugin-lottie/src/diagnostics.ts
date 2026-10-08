/** A known compatibility gap, located with a JSON Pointer into the source file. */
export interface LottieDiagnostic {
  code: string;
  severity: 'partial' | 'unsupported';
  path: string;
  message: string;
}

/**
 * Inspect without changing the source JSON or evaluating expressions.
 * This reports known gaps; an empty list is not a certification of AE parity.
 */
export function inspectLottie(data: unknown): LottieDiagnostic[] {
  const diagnostics: LottieDiagnostic[] = [];
  const add = (
    code: string,
    severity: LottieDiagnostic['severity'],
    path: string,
    message: string,
  ) => {
    diagnostics.push({ code, severity, path, message });
  };
  const unsupportedShapes: Record<string, string> = {
    rd: 'Round Corners',
    mm: 'Merge Paths',
    op: 'Offset Paths',
    pb: 'Pucker & Bloat',
    zz: 'Zig Zag',
    tw: 'Twist',
  };
  const animated = (property: any) => property?.a === 1;
  const nonzero = (property: any) =>
    property && (animated(property) || property.k !== 0);
  const visit = (
    value: any,
    path: string,
    composition: any,
    isLayer = false,
  ) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item, i) =>
        visit(item, `${path}/${i}`, composition, isLayer),
      );
      return;
    }
    // Hidden layers/shapes do not contribute to the rendered composition.
    if (value.hd === true) return;
    if (isLayer && typeof value.ty === 'number') {
      if (value.ty === 5)
        add(
          'layer.text',
          'unsupported',
          path,
          'Text layers and text animators are not rendered.',
        );
      else if (value.ty === 2)
        add(
          'layer.image',
          'partial',
          path,
          'Image layers do not resolve asset directories or preload images.',
        );
      else if (![0, 1, 3, 4].includes(value.ty))
        add(
          'layer.type',
          'unsupported',
          `${path}/ty`,
          `Layer type ${value.ty} is not rendered.`,
        );
      if (value.ddd === 1)
        add(
          'layer.3d',
          'unsupported',
          `${path}/ddd`,
          'Only 2D transforms are rendered.',
        );
      if (value.bm)
        add(
          'layer.blend',
          'unsupported',
          `${path}/bm`,
          'Lottie blend modes are not mapped to ECS blend modes.',
        );
      if (value.tt || value.td)
        add(
          'layer.matte',
          'unsupported',
          path,
          'Track mattes are not implemented.',
        );
      if (value.masksProperties?.length)
        add(
          'layer.masks',
          'unsupported',
          `${path}/masksProperties`,
          'Mask modes, inversion and animated masks are not reliably rendered.',
        );
      if (value.ef?.length)
        add(
          'layer.effects',
          'unsupported',
          `${path}/ef`,
          'Layer effects are not implemented.',
        );
      if (value.sr != null && value.sr !== 1)
        add(
          'time.stretch',
          'unsupported',
          `${path}/sr`,
          'Layer time stretch is not applied.',
        );
      if (value.tm != null)
        add(
          'time.remap',
          'unsupported',
          `${path}/tm`,
          'Time remapping is not applied.',
        );
      if (
        (composition?.ip != null &&
          value.ip != null &&
          value.ip !== composition.ip) ||
        (composition?.op != null &&
          value.op != null &&
          value.op !== composition.op)
      ) {
        add(
          'time.visibility',
          'partial',
          path,
          'Layer in/out visibility is not fully applied.',
        );
      }
    }
    if (typeof value.ty === 'string') {
      if (unsupportedShapes[value.ty])
        add(
          `shape.${value.ty}`,
          'unsupported',
          path,
          `${unsupportedShapes[value.ty]} is not rendered.`,
        );
      else if (value.ty === 'tm')
        add(
          'shape.trim',
          'partial',
          path,
          'Trim Paths uses stroke dashes: filled shapes, multiple paths, existing dash patterns, animated zero-length round caps, direction and modifier ordering can differ from Lottie.',
        );
      else if (
        ![
          'gr',
          'tr',
          'sh',
          'el',
          'rc',
          'sr',
          'rp',
          'fl',
          'st',
          'gf',
          'gs',
          'no',
        ].includes(value.ty)
      )
        add(
          'shape.type',
          'unsupported',
          `${path}/ty`,
          `Shape operator ${value.ty} is not rendered.`,
        );
      if (value.ty === 'gf' || value.ty === 'gs') {
        if (
          animated(value.s) ||
          animated(value.e) ||
          nonzero(value.h) ||
          nonzero(value.a)
        )
          add(
            'paint.gradient',
            'partial',
            path,
            'Animated gradient geometry and radial highlights are not fully implemented.',
          );
      }
      if (value.ty === 'el' || value.ty === 'rc') {
        if (animated(value.s) || animated(value.r))
          add(
            'shape.geometry',
            'partial',
            path,
            'Animated primitive size and corner radius are parsed but not fully applied by ECS.',
          );
      }
    }
    if (nonzero(value.sk))
      add(
        'transform.skew',
        'unsupported',
        `${path}/sk`,
        'Skew is parsed but not applied by the renderer.',
      );
    if (value.to || value.ti)
      add(
        'transform.spatial',
        'partial',
        path,
        'Spatial Bézier motion is parsed but the runtime does not follow the motion path.',
      );
    if (typeof value.x === 'string' && value.x.trim())
      add(
        'expression',
        'partial',
        `${path}/x`,
        'Expressions are baked at import time using a limited layer environment, not the full AE runtime.',
      );
    for (const key of ['shapes', 'it']) {
      const operators = value[key];
      if (Array.isArray(operators)) {
        const containsRepeater = (items: any[]): boolean =>
          items.some(
            (item) =>
              !item.hd &&
              (item.ty === 'rp' ||
                (Array.isArray(item.it) && containsRepeater(item.it))),
          );
        operators.forEach((operator, i) => {
          if (
            !operator.hd &&
            operator.ty === 'rp' &&
            containsRepeater(operators.slice(0, i))
          )
            add(
              'shape.repeater.nested',
              'partial',
              `${path}/${key}/${i}`,
              'Nested or stacked Repeaters use recursive duplication; lottie-web compound ordering and retained source copies can differ.',
            );
          if (
            !operator.hd &&
            operator.ty === 'rp' &&
            operators
              .slice(i + 1)
              .some(
                (item) =>
                  !item.hd && ['fl', 'st', 'gf', 'gs'].includes(item.ty),
              )
          )
            add(
              'shape.repeater.paint-scope',
              'partial',
              `${path}/${key}/${i}`,
              'Paints after a Repeater are inherited per copy; shared compound fill coverage and opacity can differ. Put paints inside the repeated group for per-copy rendering.',
            );
        });
        const paints = operators.filter(
          (item) => !item.hd && ['fl', 'st', 'gf', 'gs'].includes(item.ty),
        );
        if (
          paints.filter((item) => ['fl', 'gf'].includes(item.ty)).length > 1 ||
          paints.filter((item) => ['st', 'gs'].includes(item.ty)).length > 1
        ) {
          add(
            'paint.multiple',
            'partial',
            `${path}/${key}`,
            'Multiple fills/strokes and operator ordering are not fully preserved.',
          );
        }
      }
    }
    Object.entries(value).forEach(([key, child]) => {
      const escaped = key.replace(/~/g, '~0').replace(/\//g, '~1');
      visit(
        child,
        `${path}/${escaped}`,
        key === 'layers' && value.ip != null ? value : composition,
        key === 'layers',
      );
    });
  };
  visit(data, '', data);
  return diagnostics;
}
