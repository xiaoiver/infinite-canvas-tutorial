import type { SerializedNode } from '../../packages/ecs/src';
import * as ts from 'typescript';
import { ThemeMode } from '../../packages/ecs/src/components/Theme';
import {
  serializedNodesToCode,
  buildCodeIR,
} from '../../packages/ecs/src/utils/codegen';

describe('design-to-code (codegen)', () => {
  describe('react-tailwind emitter', () => {
    it('keeps solid rectangle and ellipse fill layers in paint order', () => {
      const fills = [
        { type: 'solid', value: '#ff0000', opacity: 0.5 },
        { type: 'solid', value: '#00ff00', enabled: false },
        { type: 'solid', value: '#0000ff', opacity: 0.25 },
      ];
      for (const type of ['rect', 'ellipse'] as const) {
        const node = {
          id: `layered-${type}`,
          type,
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          zIndex: 0,
          fills,
        } as SerializedNode;
        const react = serializedNodesToCode([node]);
        expect(react).toContain('backgroundImage:');
        expect(react.indexOf('#0000ff')).toBeLessThan(react.indexOf('#ff0000'));
        expect(react).toContain('color-mix(in srgb, #0000ff 25%, transparent)');
        expect(react).toContain('color-mix(in srgb, #ff0000 50%, transparent)');
        expect(react).not.toContain('#00ff00');
        expect(react).not.toContain('backgroundColor:');
        if (type === 'ellipse') expect(react).toContain('rounded-[50%]');
        const html = serializedNodesToCode([node], {
          framework: 'html-css',
        });
        expect(html).toContain('background-image:');
        expect(html.indexOf('#0000ff')).toBeLessThan(html.indexOf('#ff0000'));
        expect(html).not.toContain('#00ff00');
        if (type === 'ellipse') expect(html).toContain('border-radius: 50%');
      }
    });

    it('combines solid and CSS gradient backgrounds in paint order', () => {
      const fills = [
        { type: 'solid', value: '#ff0000' },
        {
          type: 'gradient',
          value: 'linear-gradient(90deg, transparent 0%, #ffffff 100%)',
        },
        { type: 'solid', value: '#0000ff', opacity: 0.25 },
      ];
      for (const type of ['rect', 'ellipse'] as const) {
        const node = {
          id: `mixed-${type}`,
          type,
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          zIndex: 0,
          fills,
        } as SerializedNode;
        for (const framework of ['react-tailwind', 'html-css'] as const) {
          const code = serializedNodesToCode([node], { framework });
          expect(code).toContain(
            'linear-gradient(90deg, transparent 0%, #ffffff 100%)',
          );
          expect(code.indexOf('#0000ff')).toBeLessThan(
            code.indexOf('linear-gradient(90deg'),
          );
          expect(code.indexOf('linear-gradient(90deg')).toBeLessThan(
            code.indexOf('#ff0000'),
          );
          expect(code).not.toContain('backgroundColor:');
        }
      }
    });

    it('keeps positioned conic gradients above lower fill layers', () => {
      for (const type of ['rect', 'ellipse'] as const) {
        const node = {
          id: `conic-${type}`,
          type,
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          zIndex: 0,
          fills: [
            { type: 'solid', value: '#ff0000' },
            {
              type: 'gradient',
              value: 'conic-gradient(circle at 25% 75%, blue, transparent)',
            },
          ],
        } as SerializedNode;
        for (const framework of ['react-tailwind', 'html-css'] as const) {
          const code = serializedNodesToCode([node], { framework });
          expect(code).toContain(
            'conic-gradient(at 25% 75%, blue, transparent)',
          );
          expect(code.indexOf('conic-gradient(')).toBeLessThan(
            code.indexOf('#ff0000'),
          );
          expect(code).not.toContain('conic-gradient(circle');
        }
      }
    });

    it('exports untransformed pattern fills with native tile size', () => {
      for (const type of ['rect', 'ellipse'] as const) {
        for (const repetition of [
          'repeat',
          'repeat-x',
          'repeat-y',
          'no-repeat',
        ] as const) {
          const node = {
            id: `pattern-${type}-${repetition}`,
            type,
            x: 0,
            y: 0,
            width: 100,
            height: 80,
            zIndex: 0,
            fills: [{ type: 'pattern', value: '/tile.png', repetition }],
          } as SerializedNode;
          const react = serializedNodesToCode([node]);
          expect(react).toContain('url(\\"/tile.png\\")');
          expect(react).toContain('backgroundSize: "auto"');
          expect(react).toContain(`backgroundRepeat: "${repetition}"`);
          const html = serializedNodesToCode([node], {
            framework: 'html-css',
          });
          expect(html).toContain(
            'background-image: url(&quot;/tile.png&quot;)',
          );
          expect(html).toContain('background-size: auto');
          expect(html).toContain(`background-repeat: ${repetition}`);
        }
      }
      const transformed = {
        id: 'transformed-pattern',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        zIndex: 0,
        fills: [
          { type: 'pattern', value: '/tile.png', transform: 'rotate(30)' },
        ],
      } as SerializedNode;
      const transformedReact = serializedNodesToCode([transformed]);
      const transformedHtml = serializedNodesToCode([transformed], {
        framework: 'html-css',
      });
      expect(transformedReact).toContain('backgroundImage:');
      expect(transformedReact).toContain('transform: "matrix(');
      expect(transformedHtml).toContain('transform: matrix(');
      expect(transformedHtml).toContain('background-image: url(');
    });

    it('stacks natural-size image and tiled pattern above a solid fill', () => {
      const nodes = [
        {
          id: 'tiled-photo',
          type: 'rect',
          x: 0,
          y: 0,
          width: 120,
          height: 80,
          zIndex: 0,
          fills: [
            { type: 'solid', value: '#ff0000' },
            { type: 'pattern', value: '/tile.png', repetition: 'repeat-x' },
            {
              type: 'image',
              value: '/photo.png',
              objectFit: 'none',
              objectPosition: 'right bottom',
              blendMode: 'multiply',
            },
          ],
        },
        {
          id: 'tiled-label',
          type: 'text',
          parentId: 'tiled-photo',
          x: 0,
          y: 0,
          zIndex: 1,
          content: 'Label',
          fontSize: 16,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react.indexOf('/photo.png')).toBeLessThan(
        react.indexOf('/tile.png'),
      );
      expect(react.indexOf('/tile.png')).toBeLessThan(react.indexOf('#ff0000'));
      expect(react).toContain('backgroundSize: "auto, auto, 100% 100%"');
      expect(react).toContain(
        'backgroundPosition: "right bottom, 0% 0%, 0% 0%"',
      );
      expect(react).toContain(
        'backgroundRepeat: "no-repeat, repeat-x, no-repeat"',
      );
      expect(react).toContain(
        'backgroundBlendMode: "multiply, normal, normal"',
      );
      expect(react).toContain('Label');
      expect(react).not.toContain('<img');
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('background-size: auto, auto, 100% 100%');
      expect(html).toContain(
        'background-repeat: no-repeat, repeat-x, no-repeat',
      );
      expect(html).toContain('Label');
      expect(html).not.toContain('<img');
    });

    it('exports layered image backgrounds with fit, position, blend, and children', () => {
      for (const type of ['rect', 'ellipse'] as const) {
        const nodes = [
          {
            id: `photo-${type}`,
            type,
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            zIndex: 0,
            fills: [
              { type: 'solid', value: '#ff0000' },
              {
                type: 'image',
                value: 'https://example.com/photo.png?a=1&b=2',
                objectFit: 'contain',
                objectPosition: '20% 80%',
                blendMode: 'multiply',
              },
              {
                type: 'gradient',
                value: 'linear-gradient(90deg, transparent, #ffffff)',
                blendMode: 'screen',
              },
            ],
          },
          {
            id: `label-${type}`,
            type: 'text',
            parentId: `photo-${type}`,
            x: 10,
            y: 10,
            zIndex: 1,
            content: 'Photo',
            fontSize: 16,
          },
        ] as SerializedNode[];
        const react = serializedNodesToCode(nodes);
        expect(react).toContain('backgroundImage:');
        expect(react).toContain(
          'url(\\"https://example.com/photo.png?a=1&b=2\\")',
        );
        expect(react).toContain(
          'backgroundSize: "100% 100%, contain, 100% 100%"',
        );
        expect(react).toContain('backgroundPosition: "0% 0%, 20% 80%, 0% 0%"');
        expect(react).toContain(
          'backgroundRepeat: "no-repeat, no-repeat, no-repeat"',
        );
        expect(react).toContain(
          'backgroundBlendMode: "screen, multiply, normal"',
        );
        expect(react.indexOf('linear-gradient(90deg')).toBeLessThan(
          react.indexOf('url('),
        );
        expect(react.indexOf('url(')).toBeLessThan(react.indexOf('#ff0000'));
        expect(react).toContain('Photo');
        expect(react).not.toContain('<img');
        if (type === 'ellipse') expect(react).toContain('rounded-[50%]');

        const html = serializedNodesToCode(nodes, { framework: 'html-css' });
        expect(html).toContain(
          'url(&quot;https://example.com/photo.png?a=1&amp;b=2&quot;)',
        );
        expect(html).toContain(
          'background-size: 100% 100%, contain, 100% 100%',
        );
        expect(html).toContain('background-position: 0% 0%, 20% 80%, 0% 0%');
        expect(html).toContain(
          'background-repeat: no-repeat, no-repeat, no-repeat',
        );
        expect(html).toContain(
          'background-blend-mode: screen, multiply, normal',
        );
        expect(html).toContain('Photo');
        expect(html).not.toContain('<img');
        if (type === 'ellipse') expect(html).toContain('border-radius: 50%');
      }
    });

    it('keeps per-paint opacity and scale-down sizing behind child content', () => {
      for (const type of ['rect', 'ellipse'] as const) {
        const nodes = [
          {
            id: `paint-${type}`,
            type,
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            zIndex: 0,
            fills: [
              { type: 'solid', value: '#ffffff' },
              {
                type: 'gradient',
                value: 'linear-gradient(red, blue)',
                opacity: 0.4,
              },
              {
                type: 'image',
                value: '/photo.png',
                objectFit: 'scale-down',
                objectPosition: '20% 80%',
                opacity: 0.6,
              },
              {
                type: 'pattern',
                value: '/tile.png',
                repetition: 'repeat-x',
                opacity: 0.5,
              },
            ],
          },
          {
            id: `caption-${type}`,
            type: 'text',
            parentId: `paint-${type}`,
            x: 4,
            y: 4,
            zIndex: 1,
            content: 'Caption',
            fontSize: 16,
          },
        ] as SerializedNode[];
        const react = serializedNodesToCode(nodes);
        expect(react).toContain('zIndex: -1');
        expect(react).toContain('objectFit: "scale-down"');
        expect(react).toContain('objectPosition: "20% 80%"');
        expect(react).toContain('backgroundRepeat: "repeat-x"');
        expect(react).toContain('opacity: "0.40"');
        expect(react).toContain('opacity: "0.60"');
        expect(react).toContain('opacity: "0.50"');
        expect(react.indexOf('/photo.png')).toBeLessThan(
          react.indexOf('/tile.png'),
        );
        expect(react.indexOf('/tile.png')).toBeLessThan(
          react.indexOf('Caption'),
        );
        if (type === 'ellipse') expect(react).toContain('rounded-[50%]');
        const html = serializedNodesToCode(nodes, { framework: 'html-css' });
        expect(html).toContain('object-fit: scale-down');
        expect(html).toContain('background-repeat: repeat-x');
        expect(html).toContain('opacity: 0.40');
        expect(html).toContain('opacity: 0.60');
        expect(html).toContain('opacity: 0.50');
        expect(html).toContain('Caption');
        if (type === 'ellipse') expect(html).toContain('border-radius: 50%');
      }
    });

    it('blends supported rectangle backgrounds with lower fill layers', () => {
      const node = {
        id: 'blended-background',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        zIndex: 0,
        fills: [
          { type: 'solid', value: '#ff0000' },
          { type: 'solid', value: '#0000ff', blendMode: 'multiply' },
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, #000000 0%, #ffffff 100%)',
            blendMode: 'screen',
          },
        ],
      } as SerializedNode;
      const react = serializedNodesToCode([node]);
      expect(react).toContain(
        'backgroundBlendMode: "screen, multiply, normal"',
      );
      expect(react.indexOf('#ffffff')).toBeLessThan(react.indexOf('#0000ff'));
      const html = serializedNodesToCode([node], { framework: 'html-css' });
      expect(html).toContain('background-blend-mode: screen, multiply, normal');
      expect(html.indexOf('#ffffff')).toBeLessThan(html.indexOf('#0000ff'));

      const unsupported = serializedNodesToCode([
        {
          ...node,
          fills: [
            { type: 'solid', value: '#ff0000' },
            { type: 'solid', value: '#0000ff', blendMode: 'linearBurn' },
          ],
        } as SerializedNode,
      ]);
      expect(unsupported).not.toContain('backgroundBlendMode');
      expect(unsupported).not.toContain('backgroundImage');
    });

    it('exports image-filled ellipses with their round mask and children', () => {
      const ellipse = {
        id: 'avatar',
        type: 'ellipse',
        x: 0,
        y: 0,
        width: 80,
        height: 80,
        zIndex: 0,
        clipMode: 'clip',
        fills: [
          {
            type: 'image',
            value: 'https://example.com/avatar.png',
            objectFit: 'cover',
          },
        ],
      } as SerializedNode;
      const leafReact = serializedNodesToCode([ellipse]);
      expect(leafReact).toContain('<img src="https://example.com/avatar.png"');
      expect(leafReact).toContain('rounded-[50%]');
      expect(leafReact).toContain('objectFit: "cover"');
      const leafHtml = serializedNodesToCode([ellipse], {
        framework: 'html-css',
      });
      expect(leafHtml).toContain('<img src="https://example.com/avatar.png"');
      expect(leafHtml).toContain('border-radius: 50%');
      expect(leafHtml).toContain('object-fit: cover');

      const nodes = [
        ellipse,
        {
          id: 'badge',
          type: 'text',
          parentId: 'avatar',
          x: 20,
          y: 20,
          zIndex: 1,
          content: 'A',
          fontSize: 20,
        } as SerializedNode,
      ];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain('rounded-[50%]');
      expect(react).toContain('overflow-hidden');
      expect(react).toContain(
        '<img src="https://example.com/avatar.png" alt=""',
      );
      expect(react.indexOf('<img')).toBeLessThan(react.indexOf('>A<'));
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('border-radius: 50%');
      expect(html).toContain('overflow: hidden');
      expect(html).toContain(
        '<img src="https://example.com/avatar.png" alt=""',
      );
      expect(html.indexOf('<img')).toBeLessThan(html.indexOf('>A<'));
    });

    it('keeps children above an image-filled rectangle', () => {
      const nodes = [
        {
          id: 'photo-card',
          type: 'rect',
          x: 0,
          y: 0,
          width: 240,
          height: 120,
          zIndex: 0,
          display: 'flex',
          alignItems: 'center',
          cornerRadius: 12,
          clipMode: 'clip',
          opacity: 0.8,
          fills: [
            {
              type: 'image',
              value: 'https://example.com/photo.png',
              objectFit: 'cover',
              objectPosition: 'left top',
              opacity: 0.5,
            },
          ],
        },
        {
          id: 'caption',
          type: 'text',
          parentId: 'photo-card',
          x: 10,
          y: 10,
          zIndex: 1,
          content: 'Caption',
          fontSize: 18,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain('relative');
      expect(react).toContain('isolate');
      expect(react).toContain('overflow-hidden');
      expect(react).toContain(
        '<img src="https://example.com/photo.png" alt=""',
      );
      expect(react).toContain('objectFit: "cover"');
      expect(react).toContain('objectPosition: "left top"');
      expect(react).toContain('opacity: "0.50"');
      expect(react.indexOf('<img')).toBeLessThan(react.indexOf('Caption'));
      expect(react).toContain('opacity-[0.80]');
      expect(react).not.toContain('opacity-[0.40]');
      expect(
        ts
          .transpileModule(react, {
            fileName: 'Design.tsx',
            reportDiagnostics: true,
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
          })
          .diagnostics?.filter(
            (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
          ),
      ).toEqual([]);
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('isolation: isolate');
      expect(html).toContain('overflow: hidden');
      expect(html).toContain('<img src="https://example.com/photo.png" alt=""');
      expect(html).toContain('object-fit: cover');
      expect(html).toContain('object-position: left top');
      expect(html).toContain('opacity: 0.50');
      expect(html.indexOf('<img')).toBeLessThan(html.indexOf('Caption'));
    });

    it('exports single image paints on vector fills and strokes', () => {
      const path = {
        id: 'photo-path',
        type: 'path',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        zIndex: 0,
        d: 'M 10 20 L 110 20 L 110 80 Z',
        fills: [
          {
            type: 'image',
            value: 'https://example.com/photo.png?a=1&b=2',
            objectFit: 'cover',
            opacity: 0.6,
          },
        ],
        strokes: [
          {
            type: 'image',
            value: 'https://example.com/border.png',
            objectFit: 'contain',
          },
        ],
        strokeWidth: 3,
      } as SerializedNode;
      const react = serializedNodesToCode([path]);
      expect(react).toContain(
        '<pattern id={"ic-image-70-68-6f-74-6f-2d-70-61-74-68-fill"}',
      );
      expect(react).toContain('preserveAspectRatio={"xMidYMid slice"}');
      expect(react).toContain('preserveAspectRatio={"xMidYMid meet"}');
      expect(react).toContain('href={"https://example.com/photo.png?a=1&b=2"}');
      expect(react).toContain(
        'fill={"url(#ic-image-70-68-6f-74-6f-2d-70-61-74-68-fill)"}',
      );
      expect(react).toContain(
        'stroke={"url(#ic-image-70-68-6f-74-6f-2d-70-61-74-68-stroke)"}',
      );
      expect(react).toContain('fillOpacity={"0.60"}');
      expect(react).toContain('strokeWidth={3}');
      expect(
        ts
          .transpileModule(react, {
            fileName: 'Design.tsx',
            reportDiagnostics: true,
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
          })
          .diagnostics?.filter(
            (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
          ),
      ).toEqual([]);
      const html = serializedNodesToCode([path], { framework: 'html-css' });
      expect(html).toContain(
        'href="https://example.com/photo.png?a=1&amp;b=2"',
      );
      expect(html).toContain('preserveAspectRatio="xMidYMid slice"');
      expect(html).toContain('fill-opacity="0.60"');

      const stretched = serializedNodesToCode([
        {
          ...path,
          id: 'stretched',
          fills: [{ type: 'image', value: 'data:image/png;base64,AAA' }],
          strokes: [],
        } as SerializedNode,
      ]);
      expect(stretched).toContain('preserveAspectRatio={"none"}');
      const positionedImage = serializedNodesToCode([
        {
          ...path,
          id: 'offset-image',
          fills: [
            {
              type: 'image',
              value: 'https://example.com/photo.png',
              objectPosition: '20% 80%',
            },
          ],
          strokes: [],
        } as SerializedNode,
      ]);
      expect(positionedImage).not.toContain('<pattern');
      expect(positionedImage).toContain('<foreignObject');
      expect(positionedImage).toContain('objectPosition: "20% 80%"');
      expect(positionedImage).toContain('<clipPath');

      for (const fit of ['none', 'scale-down'] as const) {
        const fitted = {
          ...path,
          fills: [
            {
              type: 'image',
              value: 'https://example.com/photo.png',
              objectFit: fit,
              objectPosition: '20% 80%',
              opacity: 0.4,
            },
          ],
          strokes: [],
        } as SerializedNode;
        const fittedReact = serializedNodesToCode([fitted]);
        const fittedHtml = serializedNodesToCode([fitted], {
          framework: 'html-css',
        });
        expect(fittedReact).toContain('<foreignObject');
        expect(fittedReact).toContain(`objectFit: "${fit}"`);
        expect(fittedReact).toContain('opacity={"0.40"}');
        expect(fittedHtml).toContain('<foreignObject');
        expect(fittedHtml).toContain(`object-fit: ${fit}`);
        expect(fittedHtml).toContain('object-position: 20% 80%');
        expect(fittedHtml).toContain('opacity="0.40"');
        expect(
          ts
            .transpileModule(fittedReact, {
              fileName: 'Design.tsx',
              reportDiagnostics: true,
              compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
            })
            .diagnostics?.filter(
              (diagnostic) =>
                diagnostic.category === ts.DiagnosticCategory.Error,
            ),
        ).toEqual([]);
      }

      for (const [position, fit, alignment] of [
        ['left top', 'cover', 'xMinYMin slice'],
        ['bottom right', 'contain', 'xMaxYMax meet'],
        ['100% 0%', 'cover', 'xMaxYMin slice'],
        ['top', 'contain', 'xMidYMin meet'],
        ['center left', 'contain', 'xMinYMid meet'],
        ['center right', 'cover', 'xMaxYMid slice'],
      ] as const) {
        const positioned = {
          ...path,
          fills: [
            {
              type: 'image',
              value: 'https://example.com/photo.png',
              objectFit: fit,
              objectPosition: position,
            },
          ],
          strokes: [],
        } as SerializedNode;
        expect(serializedNodesToCode([positioned])).toContain(
          `preserveAspectRatio={"${alignment}"}`,
        );
        expect(
          serializedNodesToCode([positioned], { framework: 'html-css' }),
        ).toContain(`preserveAspectRatio="${alignment}"`);
      }
    });

    it('exports positioned image strokes as masked HTML in both dialects', () => {
      const path = {
        id: 'positioned-stroke',
        type: 'path',
        x: 0,
        y: 0,
        width: 60,
        height: 60,
        zIndex: 0,
        d: 'M 10 10 H 50 V 50 H 10 Z',
        strokes: [
          {
            type: 'image',
            value: 'https://example.com/border.png?a=1&b=2',
            objectFit: 'none',
            objectPosition: '20% 80%',
            opacity: 0.5,
          },
        ],
        strokeWidth: 8,
        strokeAlignment: 'outer',
        markerEnd: 'triangle',
      } as SerializedNode;
      const react = serializedNodesToCode([path]);
      expect(react).toContain('maskImage:');
      expect(react).toContain('WebkitMaskImage:');
      expect(react).toContain('objectFit: "none"');
      expect(react).toContain('objectPosition: "20% 80%"');
      expect(react).toContain('opacity: "0.50"');
      expect(react).toContain(
        '<img src={"https://example.com/border.png?a=1&b=2"}',
      );
      expect(react).not.toContain('<pattern');
      expect(
        ts
          .transpileModule(react, {
            fileName: 'Design.tsx',
            reportDiagnostics: true,
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
          })
          .diagnostics?.filter(
            (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
          ),
      ).toEqual([]);
      const html = serializedNodesToCode([path], { framework: 'html-css' });
      expect(html).toContain('mask-image:');
      expect(html).toContain('-webkit-mask-image:');
      expect(html).toContain('object-fit: none');
      expect(html).toContain('object-position: 20% 80%');
      expect(html).toContain('opacity: 0.50');
      expect(html).toContain('border.png?a=1&amp;b=2');
    });

    it('keeps normal vector fill layers in canvas order', () => {
      const path = {
        id: 'layers',
        type: 'path',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        zIndex: 0,
        d: 'M 0 0 L 100 0 L 100 60 Z',
        fills: [
          { type: 'solid', value: '#ff0000', opacity: 0.25 },
          { type: 'solid', value: '#00ff00', enabled: false },
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, #ffffff 0%, #000000 100%)',
            opacity: 0.5,
          },
          {
            type: 'image',
            value: 'https://example.com/texture.png',
            objectFit: 'cover',
            opacity: 0.75,
          },
        ],
        strokes: [{ type: 'solid', value: '#222222' }],
        strokeWidth: 2,
      } as SerializedNode;
      const react = serializedNodesToCode([path]);
      const reactPaths = [...react.matchAll(/^\s*<path .* \/>$/gm)].map(
        ([line]) => line,
      );
      expect(reactPaths).toHaveLength(4);
      expect(reactPaths[0]).toContain('#ff0000');
      expect(reactPaths[1]).toContain('ic-gradient-6c-61-79-65-72-73-fill-1');
      expect(reactPaths[1]).toContain('fillOpacity={"0.50"}');
      expect(reactPaths[2]).toContain('ic-image-6c-61-79-65-72-73-fill-2');
      expect(reactPaths[2]).toContain('fillOpacity={"0.75"}');
      expect(reactPaths[3]).toContain('stroke={"#222222"}');
      expect(react).not.toContain('#00ff00');
      const html = serializedNodesToCode([path], { framework: 'html-css' });
      const htmlPaths = [...html.matchAll(/^\s*<path .* \/>$/gm)].map(
        ([line]) => line,
      );
      expect(htmlPaths).toHaveLength(4);
      expect(htmlPaths[0]).toContain('#ff0000');
      expect(htmlPaths[1]).toContain('ic-gradient-6c-61-79-65-72-73-fill-1');
      expect(htmlPaths[2]).toContain('ic-image-6c-61-79-65-72-73-fill-2');
      expect(htmlPaths[3]).toContain('stroke="#222222"');
    });

    it('exports normal vector stroke layers in canvas order', () => {
      const path = {
        id: 'stroke-layers',
        type: 'path',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        zIndex: 0,
        d: 'M 0 0 L 100 0 L 100 60 Z',
        fills: [{ type: 'solid', value: '#ffffff' }],
        strokes: [
          { type: 'solid', value: '#ff0000', opacity: 0.5 },
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, #00ff00 0%, #0000ff 100%)',
            opacity: 0.75,
          },
          { type: 'image', value: '/stroke.png', objectFit: 'cover' },
        ],
        strokeWidth: 3,
        strokeLinecap: 'round',
        strokeDasharray: '4,2',
      } as SerializedNode;
      for (const framework of ['react-tailwind', 'html-css'] as const) {
        const code = serializedNodesToCode([path], { framework });
        const paths = [...code.matchAll(/^\s*<path .* \/>$/gm)].map(
          ([line]) => line,
        );
        expect(paths).toHaveLength(4);
        expect(paths[0]).toContain('#ffffff');
        expect(paths[1]).toContain(
          'color-mix(in srgb, #ff0000 50%, transparent)',
        );
        expect(paths[2]).toContain(
          'ic-gradient-73-74-72-6f-6b-65-2d-6c-61-79-65-72-73-stroke-1',
        );
        expect(paths[3]).toContain(
          'ic-image-73-74-72-6f-6b-65-2d-6c-61-79-65-72-73-stroke-2',
        );
        expect(paths.slice(1).every((line) => line.includes('stroke'))).toBe(
          true,
        );
        expect(code).toContain('/stroke.png');
        if (framework === 'react-tailwind') {
          expect(paths[2]).toContain('strokeOpacity={"0.75"}');
          expect(paths[1]).toContain('strokeDasharray={"4,2"}');
        } else {
          expect(paths[2]).toContain('stroke-opacity="0.75"');
          expect(paths[1]).toContain('stroke-dasharray="4,2"');
        }
      }
      const layeredFills = serializedNodesToCode([
        {
          ...path,
          fills: [
            { type: 'solid', value: '#ffffff' },
            { type: 'solid', value: '#222222' },
          ],
        } as SerializedNode,
      ]);
      const layeredPaths = [
        ...layeredFills.matchAll(/^\s*<path .* \/>$/gm),
      ].map(([line]) => line);
      expect(layeredPaths).toHaveLength(5);
      expect(layeredPaths[0]).toContain('#ffffff');
      expect(layeredPaths[1]).toContain('#222222');
      expect(layeredPaths[2]).toContain('#ff0000');
    });

    it('exports multiple solid strokes on lines and polylines', () => {
      for (const type of ['line', 'polyline'] as const) {
        const node = {
          id: `stroked-${type}`,
          type,
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          zIndex: 0,
          ...(type === 'line'
            ? { x1: 0, y1: 0, x2: 100, y2: 60 }
            : { points: '0,0 100,60' }),
          strokes: [
            { type: 'solid', value: '#ff0000' },
            { type: 'solid', value: '#0000ff' },
          ],
          strokeWidth: 4,
        } as SerializedNode;
        const code = serializedNodesToCode([node]);
        const paths = [...code.matchAll(/^\s*<path .* \/>$/gm)].map(
          ([line]) => line,
        );
        expect(paths).toHaveLength(2);
        expect(paths[0]).toContain('#ff0000');
        expect(paths[1]).toContain('#0000ff');
        expect(paths.every((line) => line.includes('strokeWidth={4}'))).toBe(
          true,
        );
      }
    });

    it('exports mixed vector image strokes in canvas order', () => {
      const path = {
        id: 'mixed-image-strokes',
        type: 'path',
        x: 0,
        y: 0,
        width: 60,
        height: 60,
        zIndex: 0,
        d: 'M 10 30 H 50',
        strokes: [
          { type: 'solid', value: '#ff0000' },
          {
            type: 'image',
            value: 'https://example.com/stroke.png',
            objectFit: 'none',
            objectPosition: '20% 80%',
            blendMode: 'multiply',
          },
          { type: 'solid', value: '#0000ff' },
        ],
        strokeWidth: 8,
        markerEnd: 'triangle',
      } as SerializedNode;
      for (const framework of ['react-tailwind', 'html-css'] as const) {
        const code = serializedNodesToCode([path], { framework });
        const red = code.indexOf('#ff0000');
        const image = code.indexOf('https://example.com/stroke.png');
        const blue = code.indexOf('#0000ff');
        expect(red).toBeGreaterThan(-1);
        expect(image).toBeGreaterThan(red);
        expect(blue).toBeGreaterThan(image);
        expect(code).toContain('stroke.png');
        expect(code).not.toContain('stroke={"url(#ic-image');
        if (framework === 'react-tailwind') {
          expect(code).toContain('maskImage:');
          expect(code).toContain('mixBlendMode: "multiply"');
          expect(code).toContain('isolation: "isolate"');
          expect(
            ts
              .transpileModule(code, {
                fileName: 'Design.tsx',
                reportDiagnostics: true,
                compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
              })
              .diagnostics?.filter(
                (diagnostic) =>
                  diagnostic.category === ts.DiagnosticCategory.Error,
              ),
          ).toEqual([]);
        } else {
          expect(code).toContain('mask-image:');
          expect(code).toContain('mix-blend-mode: multiply');
          expect(code).toContain('isolation: isolate');
        }
      }
    });

    it('keeps separate arrow markers and CSS blend modes on stroke layers', () => {
      const node = {
        id: 'layer-arrow',
        type: 'polyline',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        zIndex: 0,
        points: '0,0 50,60 100,0',
        strokes: [
          { type: 'solid', value: '#ff0000' },
          { type: 'solid', value: '#0000ff', blendMode: 'screen' },
        ],
        strokeWidth: 3,
        markerStart: 'triangle',
        markerEnd: 'diamond',
      } as SerializedNode;
      const react = serializedNodesToCode([node]);
      expect(react).toContain('<g style={{ isolation: "isolate" }}>');
      expect(react).toContain('style={{ mixBlendMode: "screen" }}');
      for (const side of ['start', 'end']) {
        for (const index of [0, 1]) {
          const id = `ic-marker-6c-61-79-65-72-2d-61-72-72-6f-77-${side}-${index}`;
          expect(react).toContain(`id={"${id}"}`);
          expect(react).toContain(
            `marker${side === 'start' ? 'Start' : 'End'}={"url(#${id})"}`,
          );
        }
      }
      expect(react).toContain('fill={"#ff0000"}');
      expect(react).toContain('fill={"#0000ff"}');
      const html = serializedNodesToCode([node], { framework: 'html-css' });
      expect(html).toContain('style="isolation: isolate"');
      expect(html).toContain('style="mix-blend-mode: screen"');
      expect(html).toContain(
        'marker-start="url(#ic-marker-6c-61-79-65-72-2d-61-72-72-6f-77-start-1)"',
      );
    });

    it('isolates vector fill layer blending from the surrounding canvas', () => {
      const path = {
        id: 'blend-layers',
        type: 'path',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        zIndex: 0,
        d: 'M 0 0 L 100 0 L 100 60 Z',
        fills: [
          { type: 'solid', value: '#ff0000' },
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, #ffffff 0%, #000000 100%)',
            blendMode: 'multiply',
          },
          {
            type: 'image',
            value: 'https://example.com/texture.png',
            blendMode: 'screen',
          },
        ],
        strokes: [{ type: 'solid', value: '#222222' }],
        strokeWidth: 2,
      } as SerializedNode;
      const react = serializedNodesToCode([path]);
      expect(react).toContain('<g style={{ isolation: "isolate" }}>');
      expect(react).toContain('style={{ mixBlendMode: "multiply" }}');
      expect(react).toContain('style={{ mixBlendMode: "screen" }}');
      expect(react).toContain(
        'ic-gradient-62-6c-65-6e-64-2d-6c-61-79-65-72-73-fill-1',
      );
      expect(react).toContain(
        'ic-image-62-6c-65-6e-64-2d-6c-61-79-65-72-73-fill-2',
      );
      expect(react.indexOf('</g>')).toBeLessThan(
        react.indexOf('stroke={"#222222"}'),
      );
      expect(
        ts
          .transpileModule(react, {
            fileName: 'Design.tsx',
            reportDiagnostics: true,
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
          })
          .diagnostics?.filter(
            (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
          ),
      ).toEqual([]);
      const html = serializedNodesToCode([path], { framework: 'html-css' });
      expect(html).toContain('<g style="isolation: isolate">');
      expect(html).toContain('style="mix-blend-mode: multiply"');
      expect(html).toContain('style="mix-blend-mode: screen"');

      const unsupported = serializedNodesToCode([
        {
          ...path,
          fills: [
            { type: 'solid', value: '#ff0000' },
            { type: 'solid', value: '#0000ff', blendMode: 'linearBurn' },
          ],
        } as SerializedNode,
      ]);
      expect(unsupported).not.toContain('isolation:');
      expect(unsupported).not.toContain('mixBlendMode:');
    });

    it('applies a vector shadow to the SVG artwork without shadowing children', () => {
      const path = {
        id: 'shadow-path',
        type: 'path',
        x: 0,
        y: 0,
        width: 80,
        height: 60,
        zIndex: 0,
        d: 'M 0 0 L 80 0 L 40 60 Z',
        fills: [{ type: 'solid', value: '#2563eb' }],
        dropShadowColor: '#112233',
        dropShadowOffsetX: 2,
        dropShadowOffsetY: 4,
        dropShadowBlurRadius: 6,
      } as SerializedNode;
      const react = serializedNodesToCode([path]);
      expect(react).toContain(
        '<g style={{ filter: "drop-shadow(2px 4px 6px #112233)" }}>',
      );
      expect(react).not.toContain('boxShadow');
      const html = serializedNodesToCode([path], { framework: 'html-css' });
      expect(html).toContain(
        '<g style="filter: drop-shadow(2px 4px 6px #112233)">',
      );
      expect(html).not.toContain('box-shadow');

      const withChild = serializedNodesToCode([
        path,
        {
          id: 'caption',
          type: 'text',
          parentId: 'shadow-path',
          x: 8,
          y: 8,
          zIndex: 1,
          content: 'Caption',
        } as SerializedNode,
      ]);
      expect(withChild).toContain('<g style={{ filter: "drop-shadow(');
      expect(withChild).toContain('</svg>\n      <span');
      expect(withChild).not.toContain('boxShadow');
      expect(withChild).toContain('Caption');
    });

    it('keeps inner and outer stroke alignment on closed paths', () => {
      const base = {
        id: 'ring',
        type: 'path',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 0,
        d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 25 75 L 75 75 L 75 25 Z',
        fillRule: 'evenodd',
        fills: [{ type: 'solid', value: '#ffffff' }],
        strokes: [{ type: 'solid', value: '#000000' }],
        strokeWidth: 4,
      } as SerializedNode;
      const inner = serializedNodesToCode([
        { ...base, strokeAlignment: 'inner' } as SerializedNode,
      ]);
      expect(inner).toContain('<clipPath id={"ic-stroke-72-69-6e-67"}');
      expect(inner).toContain('clipRule={"evenodd"}');
      expect(inner).toContain('stroke={"none"}');
      expect(inner).toContain('strokeWidth={8}');
      expect(inner).toContain('clipPath={"url(#ic-stroke-72-69-6e-67)"}');
      const outer = serializedNodesToCode([
        { ...base, strokeAlignment: 'outer' } as SerializedNode,
      ]);
      expect(outer).toContain('<mask id={"ic-stroke-72-69-6e-67"}');
      expect(outer).toContain(
        '<rect x={-4} y={-4} width={108} height={108} fill="white"',
      );
      expect(outer).toContain('fill="black" fillRule={"evenodd"}');
      expect(outer).toContain('mask={"url(#ic-stroke-72-69-6e-67)"}');
      const html = serializedNodesToCode(
        [{ ...base, strokeAlignment: 'outer' } as SerializedNode],
        { framework: 'html-css' },
      );
      expect(html).toContain('<mask id="ic-stroke-72-69-6e-67"');
      expect(html).toContain('fill="black" fill-rule="evenodd"');
      expect(html).toContain('stroke-width="8"');
      expect(html).toContain('mask="url(#ic-stroke-72-69-6e-67)"');

      const open = serializedNodesToCode([
        {
          ...base,
          d: 'M 0 0 L 100 100',
          strokeAlignment: 'inner',
        } as SerializedNode,
      ]);
      expect(open).not.toContain('<clipPath');
      expect(open).toContain('strokeWidth={4}');
    });

    it('clips every stroke layer for inner and outer closed-path alignment', () => {
      const base = {
        id: 'layered-ring',
        type: 'path',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 0,
        d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 25 75 L 75 75 L 75 25 Z',
        fillRule: 'evenodd',
        fills: [{ type: 'solid', value: '#ffffff' }],
        strokes: [
          { type: 'solid', value: '#ff0000', opacity: 0.5 },
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, #00ff00 0%, #0000ff 100%)',
            opacity: 0.75,
          },
        ],
        strokeWidth: 4,
      } as SerializedNode;
      for (const alignment of ['inner', 'outer'] as const) {
        const react = serializedNodesToCode([
          { ...base, strokeAlignment: alignment } as SerializedNode,
        ]);
        const strokePaths = [
          ...react.matchAll(/^\s*<path .*strokeWidth=\{8\}.* \/>$/gm),
        ].map(([line]) => line);
        expect(strokePaths).toHaveLength(2);
        expect(strokePaths[0]).toContain('#ff0000');
        expect(strokePaths[1]).toContain(
          'ic-gradient-6c-61-79-65-72-65-64-2d-72-69-6e-67-stroke-1',
        );
        expect(strokePaths[1]).toContain('strokeOpacity={"0.75"}');
        const maskAttribute = alignment === 'inner' ? 'clipPath' : 'mask';
        expect(
          strokePaths.every((line) =>
            line.includes(
              `${maskAttribute}={"url(#ic-stroke-6c-61-79-65-72-65-64-2d-72-69-6e-67)"}`,
            ),
          ),
        ).toBe(true);
        const html = serializedNodesToCode(
          [{ ...base, strokeAlignment: alignment } as SerializedNode],
          { framework: 'html-css' },
        );
        expect(html.match(/stroke-width="8"/g)).toHaveLength(2);
        expect(
          html.match(
            new RegExp(
              `${
                alignment === 'inner' ? 'clip-path' : 'mask'
              }="url\\(#ic-stroke-6c-61-79-65-72-65-64-2d-72-69-6e-67\\)"`,
              'g',
            ),
          ),
        ).toHaveLength(2);
      }
      const open = serializedNodesToCode([
        {
          ...base,
          d: 'M 0 0 L 100 100',
          strokeAlignment: 'inner',
        } as SerializedNode,
      ]);
      expect(open).not.toContain('<clipPath');
      expect(open.match(/strokeWidth=\{4\}/g)).toHaveLength(2);
    });

    it('exports single linear fills and radial strokes on vector paths', () => {
      const node = {
        id: 'gradient-path',
        type: 'path',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        zIndex: 0,
        d: 'M 10 20 L 110 20 L 110 80 Z',
        fills: [
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)',
            opacity: 0.5,
          },
        ],
        strokes: [
          {
            type: 'gradient',
            value:
              'radial-gradient(circle at 50% 50%, #ffffff 0%, #000000 100%)',
            opacity: 0.75,
          },
        ],
        strokeWidth: 3,
      } as SerializedNode;
      const react = serializedNodesToCode([node]);
      expect(react).toContain('<linearGradient');
      expect(react).toContain('<radialGradient');
      expect(react).toContain('gradientUnits="userSpaceOnUse"');
      expect(react).toContain('stopColor={"#ff0000"}');
      expect(react).toContain('stopColor={"#000000"}');
      expect(react).toContain(
        'fill={"url(#ic-gradient-67-72-61-64-69-65-6e-74-2d-70-61-74-68-fill)"}',
      );
      expect(react).toContain(
        'stroke={"url(#ic-gradient-67-72-61-64-69-65-6e-74-2d-70-61-74-68-stroke)"}',
      );
      expect(react).toContain('fillOpacity={"0.50"}');
      expect(react).toContain('strokeOpacity={"0.75"}');
      expect(react).toContain('strokeWidth={3}');
      const html = serializedNodesToCode([node], { framework: 'html-css' });
      expect(html).toContain('<linearGradient');
      expect(html).toContain('<radialGradient');
      expect(html).toContain('fill-opacity="0.50"');
      expect(html).toContain('stroke-opacity="0.75"');
      expect(html).toContain('stop-color="#ff0000"');
      expect(html).toContain('stroke-width="3"');
    });

    it('exports line, triangle, and diamond arrow markers with the stroke color', () => {
      const node = {
        id: 'arrow-a',
        type: 'polyline',
        x: 0,
        y: 0,
        width: 80,
        height: 40,
        zIndex: 0,
        points: '0,0 40,40 80,0',
        strokes: [{ type: 'solid', value: '#123456', opacity: 0.5 }],
        strokeWidth: 2,
        strokeLinecap: 'round',
        markerStart: 'triangle',
        markerEnd: 'diamond',
        markerFactor: 3,
      } as SerializedNode;
      const react = serializedNodesToCode([node]);
      expect(react).toContain('<defs>');
      expect(react).toContain('orient="auto-start-reverse"');
      expect(react).toContain('orient="auto"');
      expect(react).toContain(
        'markerStart={"url(#ic-marker-61-72-72-6f-77-2d-61-start)"}',
      );
      expect(react).toContain(
        'markerEnd={"url(#ic-marker-61-72-72-6f-77-2d-61-end)"}',
      );
      expect(react).toContain(
        'stroke={"color-mix(in srgb, #123456 50%, transparent)"}',
      );
      expect(react).toContain('markerWidth={18}');
      expect(react).toContain(' L -6 0 L -3 2.4000000000000004 Z');
      expect(
        ts
          .transpileModule(react, {
            fileName: 'Design.tsx',
            reportDiagnostics: true,
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
          })
          .diagnostics?.filter(
            (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
          ),
      ).toEqual([]);

      const html = serializedNodesToCode([node], { framework: 'html-css' });
      expect(html).toContain(
        '<marker id="ic-marker-61-72-72-6f-77-2d-61-start"',
      );
      expect(html).toContain(
        'marker-start="url(#ic-marker-61-72-72-6f-77-2d-61-start)"',
      );
      expect(html).toContain(
        'marker-end="url(#ic-marker-61-72-72-6f-77-2d-61-end)"',
      );

      const open = serializedNodesToCode([
        { ...node, id: 'open-arrow', markerStart: 'line', markerEnd: 'none' },
      ]);
      expect(open).toContain('fill={"none"} stroke={"color-mix(');
      expect(open).not.toContain('markerEnd=');
    });

    it('exports thin lines and polylines as stroked vectors', () => {
      const line = {
        id: 'horizontal-line',
        type: 'line',
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        zIndex: 0,
        strokes: [{ type: 'solid', value: '#2563eb' }],
        strokeWidth: 4,
        strokeLinecap: 'round',
      } as SerializedNode;
      const react = serializedNodesToCode([line]);
      expect(react).toContain('<svg viewBox={"0 -0.50 100 1"}');
      expect(react).toContain('<path d={"M 0 0 L 100 0"} fill={"none"}');
      expect(react).toContain('stroke={"#2563eb"} strokeWidth={4}');
      const html = serializedNodesToCode([line], { framework: 'html-css' });
      expect(html).toContain('viewBox="0 -0.50 100 1"');
      expect(html).toContain('d="M 0 0 L 100 0" fill="none"');

      const polyline = {
        id: 'sparkline',
        type: 'polyline',
        x: 0,
        y: 0,
        width: 40,
        height: 10,
        zIndex: 0,
        points: '0,0 20,10 40,0',
        strokes: [{ type: 'solid', value: '#ef4444' }],
        strokeWidth: 2,
      } as SerializedNode;
      const code = serializedNodesToCode([polyline]);
      expect(code).toContain('d={"M 0 0 L 20 10 L 40 0"}');
      expect(code).toContain('fill={"none"}');
      expect(code).toContain('stroke={"#ef4444"}');

      const vertical = {
        ...line,
        id: 'vertical-line',
        width: 0,
        height: 40,
        x1: 10,
        y1: 20,
        x2: 10,
        y2: 60,
      } as SerializedNode;
      expect(serializedNodesToCode([vertical])).toContain(
        '<svg viewBox={"9.50 20 1 40"}',
      );
    });

    it('exports a solid-filled stroked path as vector geometry', () => {
      const node = {
        id: 'badge-path',
        type: 'path',
        x: 10,
        y: 20,
        width: 100,
        height: 60,
        zIndex: 0,
        d: 'M 0 0 C 30 0 70 60 100 60 Z',
        fillRule: 'evenodd',
        fills: [{ type: 'solid', value: '#ff0000', opacity: 0.5 }],
        strokes: [{ type: 'solid', value: '#0000ff' }],
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeMiterlimit: 4,
        strokeDasharray: '4,2',
      } as SerializedNode;
      const react = serializedNodesToCode([node]);
      expect(react).toContain('<svg viewBox={"0 0 100 60"}');
      expect(react).toContain('<path d={"M 0 0 C 30 0 70 60 100 60 Z"}');
      expect(react).toContain(
        'fill={"color-mix(in srgb, #ff0000 50%, transparent)"}',
      );
      expect(react).toContain('stroke={"#0000ff"} strokeWidth={2}');
      expect(react).toContain('strokeLinecap={"round"}');
      expect(react).toContain('strokeMiterlimit={4}');
      expect(react).toContain('strokeDasharray={"4,2"}');
      expect(react).not.toContain('bg-[#ff0000]');
      expect(
        ts
          .transpileModule(react, {
            fileName: 'Design.tsx',
            reportDiagnostics: true,
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
          })
          .diagnostics?.filter(
            (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
          ),
      ).toEqual([]);
      const html = serializedNodesToCode([node], { framework: 'html-css' });
      expect(html).toContain('<svg viewBox="0 0 100 60"');
      expect(html).toContain('fill-rule="evenodd"');
      expect(html).toContain('stroke-linecap="round"');
      expect(html).toContain('stroke-miterlimit="4"');
      expect(html).toContain('stroke-dasharray="4,2"');
      expect(html).not.toContain('background-color: #ff0000');

      const withChild = serializedNodesToCode([
        node,
        {
          id: 'path-label',
          type: 'text',
          parentId: 'badge-path',
          x: 8,
          y: 12,
          zIndex: 1,
          content: 'Label',
        } as SerializedNode,
      ]);
      expect(withChild).toContain(
        '<div className="relative w-[100px] h-[60px] overflow-visible"',
      );
      expect(withChild).toContain('<svg viewBox={"0 0 100 60"}');
      expect(withChild).toContain('pointerEvents: "none"');
      expect(withChild).toContain('<path d={"M 0 0 C 30 0 70 60 100 60 Z"}');
      expect(withChild).toContain('absolute left-[8px] top-[12px]');
      expect(withChild).toContain('Label');
      expect(
        ts
          .transpileModule(withChild, {
            fileName: 'Design.tsx',
            reportDiagnostics: true,
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
          })
          .diagnostics?.filter(
            (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
          ),
      ).toEqual([]);
      const withChildHtml = serializedNodesToCode(
        [
          node,
          {
            id: 'path-label',
            type: 'text',
            parentId: 'badge-path',
            x: 8,
            y: 12,
            zIndex: 1,
            content: 'Label',
          } as SerializedNode,
        ],
        { framework: 'html-css' },
      );
      expect(withChildHtml).toContain('<svg viewBox="0 0 100 60"');
      expect(withChildHtml).toContain('position: absolute; inset: 0');
      expect(withChildHtml).toContain('left: 8px; top: 12px');

      const offset = {
        ...node,
        id: 'offset-path',
        d: 'M 10 20 L 110 20 L 110 80 Z',
      } as SerializedNode;
      expect(serializedNodesToCode([offset])).toContain(
        '<svg viewBox={"10 20 100 60"}',
      );
    });

    it('preserves hidden and explicitly visible nodes without removing layout space', () => {
      const nodes = [
        {
          id: 'hidden-frame',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          visibility: 'hidden',
          zIndex: 0,
        },
        {
          id: 'visible-label',
          type: 'text',
          parentId: 'hidden-frame',
          x: 0,
          y: 0,
          content: 'Visible',
          visibility: 'visible',
          zIndex: 1,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain(
        'className="relative w-[100px] h-[50px] invisible"',
      );
      expect(react).toContain('visible');
      expect(react).not.toContain('display: "none"');
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('visibility: hidden');
      expect(html).toContain('visibility: visible');
    });

    it('keeps relative spacing between multiple sized scene roots', () => {
      const nodes = [
        {
          id: 'first',
          type: 'rect',
          x: -40,
          y: 20,
          width: 80,
          height: 60,
          zIndex: 0,
        },
        {
          id: 'second',
          type: 'ellipse',
          x: 100,
          y: 65,
          width: 50,
          height: 50,
          zIndex: 1,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain(
        'className="relative" style={{ width: 190, height: 95 }}',
      );
      expect(react).toContain('absolute left-[0px] top-[0px]');
      expect(react).toContain('absolute left-[140px] top-[45px]');
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('position: relative; width: 190px; height: 95px');
      expect(html).toContain('position: absolute; left: 140px; top: 45px');

      expect(serializedNodesToCode([nodes[0]])).not.toContain('height: 95');
      expect(
        serializedNodesToCode([
          nodes[0],
          { ...nodes[1], width: undefined } as SerializedNode,
        ]),
      ).not.toContain('className="relative"');
    });

    it('sizes the multi-root frame around rotated and flipped geometry', () => {
      const nodes = [
        {
          id: 'rotated',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          rotation: Math.PI / 2,
          zIndex: 0,
        },
        {
          id: 'flipped',
          type: 'rect',
          x: 120,
          y: 10,
          width: 40,
          height: 30,
          scaleX: -1,
          zIndex: 1,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain('style={{ width: 170, height: 100 }}');
      expect(react).toContain('absolute left-[50px] top-[0px]');
      expect(react).toContain('absolute left-[170px] top-[10px]');
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('position: relative; width: 170px; height: 100px');
      expect(html).toContain('position: absolute; left: 50px; top: 0px');
    });

    it('keeps local positions in a free-layout frame without disturbing flex children', () => {
      const nodes = [
        {
          id: 'frame',
          type: 'rect',
          x: 200,
          y: 100,
          width: 300,
          height: 180,
          zIndex: 0,
        },
        {
          id: 'badge',
          type: 'ellipse',
          parentId: 'frame',
          x: 25,
          y: 45,
          width: 40,
          height: 40,
          zIndex: 1,
        },
        {
          id: 'flex-row',
          type: 'rect',
          parentId: 'frame',
          x: 80,
          y: 20,
          width: 120,
          height: 60,
          display: 'flex',
          zIndex: 2,
        },
        {
          id: 'label',
          type: 'text',
          parentId: 'flex-row',
          x: 14,
          y: 12,
          content: 'Hello',
          zIndex: 3,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain('className="relative');
      expect(react).toContain('absolute left-[25px] top-[45px]');
      expect(react).toContain('absolute left-[80px] top-[20px]');
      expect(react).not.toContain('left-[14px]');
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('position: relative');
      expect(html).toContain('position: absolute; left: 25px; top: 45px');
      expect(html).not.toContain('left: 14px');
    });

    it('clips children to a rounded rectangle or ellipse', () => {
      for (const type of ['rect', 'ellipse'] as const) {
        const nodes = [
          {
            id: 'mask',
            type,
            x: 0,
            y: 0,
            width: 100,
            height: 80,
            cornerRadius: type === 'rect' ? 16 : undefined,
            clipMode: 'clip',
            zIndex: 0,
          },
          {
            id: 'oversized-child',
            type: 'rect',
            parentId: 'mask',
            x: 0,
            y: 0,
            width: 200,
            height: 160,
            zIndex: 1,
          },
        ] as SerializedNode[];
        const react = serializedNodesToCode(nodes);
        const html = serializedNodesToCode(nodes, { framework: 'html-css' });
        expect(react).toContain('overflow-hidden');
        expect(html).toContain('overflow: hidden');
        expect(html).toContain(
          type === 'ellipse' ? 'border-radius: 50%' : 'border-radius: 16px',
        );
        expect(
          serializedNodesToCode([{ ...nodes[0], clipMode: 'erase' }]),
        ).not.toContain('overflow-hidden');
      }
    });

    it('keeps zero line height as automatic text leading', () => {
      const nodes = [
        {
          id: 'auto-leading',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 0,
          content: 'Automatic leading',
          lineHeight: 0,
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes);
      expect(code).not.toContain('leading-[0px]');
      expect(code).toContain('lineHeight: 1.2');
      expect(serializedNodesToCode(nodes, { framework: 'html-css' })).toContain(
        'line-height: 1.2',
      );
    });

    it('keeps Yoga default flex items from shrinking in exported CSS', () => {
      const nodes = [
        {
          id: 'column',
          type: 'rect',
          x: 0,
          y: 0,
          zIndex: 0,
          width: 100,
          height: 100,
          display: 'flex',
          flexDirection: 'column',
        },
        {
          id: 'fixed-child',
          type: 'rect',
          parentId: 'column',
          x: 0,
          y: 0,
          zIndex: 1,
          width: 100,
          height: 120,
        },
      ] as SerializedNode[];
      expect(serializedNodesToCode(nodes)).toContain('shrink-0');
      expect(serializedNodesToCode(nodes, { framework: 'html-css' })).toContain(
        'flex-shrink: 0',
      );
      expect(
        serializedNodesToCode([
          nodes[0],
          { ...nodes[1], flexShrink: 1 } as SerializedNode,
        ]),
      ).not.toContain('shrink-0');
    });

    it('preserves hard line breaks and maps a wrapped text width', () => {
      const text = {
        id: 'copy',
        type: 'text',
        x: 0,
        y: 0,
        zIndex: 0,
        content: 'First line\nSecond line and more',
        wordWrap: true,
        wordWrapWidth: 120,
      } as SerializedNode;
      const react = serializedNodesToCode([text]);
      expect(react).toContain('whitespace-pre-wrap');
      expect(react).toContain('inline-block');
      expect(react).toContain('max-w-[120px]');
      expect(react).toContain('overflowWrap: "anywhere"');
      const html = serializedNodesToCode([text], { framework: 'html-css' });
      expect(html).toContain('white-space: pre-wrap');
      expect(html).toContain('max-width: 120px');
      expect(html).toContain('overflow-wrap: anywhere');

      const unwrapped = serializedNodesToCode([
        { ...text, wordWrap: false } as SerializedNode,
      ]);
      expect(unwrapped).toContain('whitespace-pre');
      expect(unwrapped).not.toContain('max-w-[120px]');
    });

    it('exports wrapped line limits for ellipsis and clip', () => {
      const text = {
        id: 'summary',
        type: 'text',
        x: 0,
        y: 0,
        zIndex: 0,
        content: 'A long summary that spans several lines',
        wordWrap: true,
        wordWrapWidth: 120,
        maxLines: 2,
      } as SerializedNode;
      const react = serializedNodesToCode([text]);
      expect(react).toContain('WebkitLineClamp: 2');
      expect(react).toContain('WebkitBoxOrient: "vertical"');
      expect(react).toContain('overflow: "hidden"');
      const html = serializedNodesToCode([text], { framework: 'html-css' });
      expect(html).toContain('-webkit-line-clamp: 2');
      expect(html).toContain('display: -webkit-box');

      const clipped = { ...text, textOverflow: 'clip' } as SerializedNode;
      expect(serializedNodesToCode([clipped])).toContain(
        'maxHeight: "calc(2 * 1lh)"',
      );
      const clippedHtml = serializedNodesToCode([clipped], {
        framework: 'html-css',
      });
      expect(clippedHtml).toContain('max-height: calc(2 * 1lh)');
      expect(clippedHtml).not.toContain('-webkit-line-clamp');

      const unwrapped = serializedNodesToCode([
        { ...text, wordWrap: false } as SerializedNode,
      ]);
      expect(unwrapped).not.toContain('WebkitLineClamp');
    });

    it('exports a single CSS gradient fill as a background image', () => {
      for (const gradient of [
        'linear-gradient(90deg, #1d4ed8, #38bdf8)',
        'radial-gradient(circle at center, #ffffff, #1d4ed8)',
        'conic-gradient(#1d4ed8, #38bdf8, #1d4ed8)',
      ]) {
        const node = {
          id: 'gradient-card',
          type: 'rect',
          x: 0,
          y: 0,
          width: 180,
          height: 100,
          zIndex: 0,
          fills: [{ type: 'gradient', value: gradient }],
        } as SerializedNode;
        expect(serializedNodesToCode([node])).toContain(
          `backgroundImage: "${gradient}"`,
        );
        expect(
          serializedNodesToCode([node], { framework: 'html-css' }),
        ).toContain(`background-image: ${gradient}`);
      }

      const positioned = {
        id: 'conic-card',
        type: 'rect',
        x: 0,
        y: 0,
        width: 180,
        height: 100,
        zIndex: 0,
        fills: [
          {
            type: 'gradient',
            value: 'conic-gradient(circle at 25% 75%, red, blue)',
          },
        ],
      } as SerializedNode;
      expect(serializedNodesToCode([positioned])).toContain(
        'backgroundImage: "conic-gradient(at 25% 75%, red, blue)"',
      );
      expect(
        serializedNodesToCode([positioned], { framework: 'html-css' }),
      ).toContain('background-image: conic-gradient(at 25% 75%, red, blue)');
      expect(
        serializedNodesToCode([
          {
            ...positioned,
            fills: [
              {
                type: 'gradient',
                value: 'conic-gradient(circle 10px at 25% 75%, red, blue)',
              },
            ],
          } as SerializedNode,
        ]),
      ).not.toContain('backgroundImage');

      const translucent = {
        id: 'layered-card',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        zIndex: 0,
        fills: [
          {
            type: 'gradient',
            value: 'linear-gradient(red, blue)',
            opacity: 0.5,
          },
        ],
      } as SerializedNode;
      const react = serializedNodesToCode([translucent]);
      expect(react).toContain('opacity: "0.50"');
      expect(react).toContain('backgroundImage: "linear-gradient(red, blue)"');
    });

    it('keeps ellipse geometry in HTML and React exports', () => {
      const ellipse = {
        id: 'avatar',
        type: 'ellipse',
        x: 0,
        y: 0,
        zIndex: 0,
        width: 80,
        height: 40,
        fills: [{ type: 'solid', value: '#2563eb' }],
      } as SerializedNode;
      const react = serializedNodesToCode([ellipse]);
      expect(react).toContain('w-[80px]');
      expect(react).toContain('h-[40px]');
      expect(react).toContain('rounded-[50%]');
      const html = serializedNodesToCode([ellipse], {
        framework: 'html-css',
      });
      expect(html).toContain('border-radius: 50%');
      expect(html).toContain('width: 80px');
      expect(html).toContain('height: 40px');

      const gradient = {
        ...ellipse,
        fills: [{ type: 'gradient', value: 'radial-gradient(red, blue)' }],
      } as SerializedNode;
      expect(serializedNodesToCode([gradient])).toContain(
        'backgroundImage: "radial-gradient(red, blue)"',
      );
    });

    it('exports rotation and flip around the canvas local origin', () => {
      const rotated = {
        id: 'rotated-card',
        type: 'rect',
        x: 0,
        y: 0,
        zIndex: 0,
        width: 100,
        height: 40,
        rotation: Math.PI / 4,
        scaleX: -1,
        scaleY: 0.5,
      } as SerializedNode;
      const react = serializedNodesToCode([rotated]);
      expect(react).toContain(
        'transform: "rotate(0.785398rad) scale(-1, 0.5)"',
      );
      expect(react).toContain('transformOrigin: "0 0"');
      const html = serializedNodesToCode([rotated], {
        framework: 'html-css',
      });
      expect(html).toContain('transform: rotate(0.785398rad) scale(-1, 0.5)');
      expect(html).toContain('transform-origin: 0 0');

      expect(
        serializedNodesToCode([
          { ...rotated, rotation: 0, scaleX: 1, scaleY: 1 } as SerializedNode,
        ]),
      ).not.toContain('transformOrigin');

      const text = {
        ...rotated,
        id: 'rotated-label',
        type: 'text',
        content: 'Tilted',
      } as SerializedNode;
      expect(serializedNodesToCode([text])).toContain('inline-block');
      expect(
        serializedNodesToCode([text], { framework: 'html-css' }),
      ).toContain('display: inline-block');
    });

    it('keeps a solid fill opacity on the paint instead of the whole node', () => {
      const card = {
        id: 'translucent-card',
        type: 'rect',
        x: 0,
        y: 0,
        zIndex: 0,
        width: 100,
        height: 40,
        opacity: 0.8,
        fills: [{ type: 'solid', value: '#2563eb', opacity: 0.5 }],
      } as SerializedNode;
      const react = serializedNodesToCode([card]);
      expect(react).toContain(
        'backgroundColor: "color-mix(in srgb, #2563eb 50%, transparent)"',
      );
      expect(react).toContain('opacity-[0.80]');
      const html = serializedNodesToCode([card], {
        framework: 'html-css',
      });
      expect(html).toContain(
        'background-color: color-mix(in srgb, #2563eb 50%, transparent)',
      );
      expect(html).toContain('opacity: 0.80');

      const text = {
        ...card,
        id: 'translucent-label',
        type: 'text',
        content: 'Label',
      } as SerializedNode;
      expect(serializedNodesToCode([text])).toContain(
        'color: "color-mix(in srgb, #2563eb 50%, transparent)"',
      );

      const tokenHtml = serializedNodesToCode(
        [
          {
            ...card,
            fills: [{ type: 'solid', value: '$color.surface', opacity: 0.25 }],
          } as SerializedNode,
        ],
        { framework: 'html-css', variablesMode: 'css-var' },
      );
      expect(tokenHtml).toContain(
        'color-mix(in srgb, var(--color-surface) 25%, transparent)',
      );
    });

    it('emits a single rect as a div with tailwind classes', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'r1',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
          cornerRadius: 8,
          fills: [{ type: 'solid', value: '#2563eb', opacity: 1 }],
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes, {
        framework: 'react-tailwind',
      });
      expect(code).toContain('export function Design()');
      expect(code).toContain('<div');
      expect(code).toContain('w-[100px]');
      expect(code).toContain('h-[100px]');
      expect(code).toContain('rounded-[8px]');
      expect(code).toContain('bg-[#2563eb]');
    });

    it('maps flex container + text child', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'box',
          type: 'rect',
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          zIndex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: 10,
        } as SerializedNode,
        {
          id: 't',
          parentId: 'box',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 1,
          content: 'Button',
          fontSize: 16,
          alignSelf: 'flex-end',
          flexBasis: 80,
          fills: [{ type: 'solid', value: '#ffffff', opacity: 1 }],
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes);
      expect(code).toContain('flex');
      expect(code).toContain('items-center');
      expect(code).toContain('justify-center');
      expect(code).toContain('gap-[10px]');
      expect(code).toContain('p-[10px]');
      expect(code).toContain('self-end');
      expect(code).toContain('basis-[80px]');
      expect(code).toContain('<span');
      expect(code).toContain('Button');
      expect(code).toContain('text-[#ffffff]');
      expect(code).toContain('text-[16px]');
    });

    it('emits lucide-react icon with import', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'i',
          type: 'iconfont',
          x: 0,
          y: 0,
          width: 24,
          height: 24,
          zIndex: 1,
          iconFontName: 'search',
          iconFontFamily: 'lucide',
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes);
      expect(code).toContain("import { Search } from 'lucide-react';");
      expect(code).toContain('<Search');
      expect(code).toContain('size={24}');
    });

    it('emits iconify icon for non-lucide families', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'i',
          type: 'iconfont',
          x: 0,
          y: 0,
          width: 24,
          height: 24,
          zIndex: 1,
          iconFontName: 'home',
          iconFontFamily: 'phosphor',
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes);
      expect(code).toContain("import { Icon } from '@iconify/react';");
      expect(code).toContain('icon="phosphor:home"');
    });
  });

  describe('design variables modes', () => {
    const nodes: SerializedNode[] = [
      {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
        fills: [{ type: 'solid', value: '$color.bg', opacity: 1 }],
      } as SerializedNode,
    ];
    const variables = {
      'color.bg': { type: 'color' as const, value: '#FFFFFF' },
    };

    it('resolved mode inlines literal values', () => {
      const code = serializedNodesToCode(nodes, {
        variablesMode: 'resolved',
        variables,
      });
      expect(code).toContain('bg-[#FFFFFF]');
      expect(code).not.toContain('$color.bg');
      expect(code).not.toContain('var(--color-bg)');
      expect(code).not.toContain('<style>');
    });

    it('css-var mode emits var(--token) class', () => {
      const code = serializedNodesToCode(nodes, {
        variablesMode: 'css-var',
        variables,
      });
      expect(code).toContain('bg-[var(--color-bg)]');
      const scope = code.match(/className="(ic-codegen-vars-[a-z0-9]+)"/)?.[1];
      expect(scope).toBeDefined();
      expect(code).toContain(
        `<style>{".${scope}{display:contents;--color-bg:#FFFFFF}"}</style>`,
      );
      expect(code).not.toContain(':root{');
    });

    it('uses the selected theme for React CSS variables', () => {
      const code = serializedNodesToCode(nodes, {
        variablesMode: 'css-var',
        themeMode: ThemeMode.DARK,
        variables: {
          'color.bg': {
            type: 'color',
            value: [
              { value: '#FFFFFF', theme: { Mode: 'Light' } },
              { value: '#121212', theme: { Mode: 'Dark' } },
            ],
          },
        },
      });
      expect(code).toMatch(
        /<style>\{"\.ic-codegen-vars-[a-z0-9]+\{display:contents;--color-bg:#121212\}"\}<\/style>/,
      );
    });

    it('keeps different exported color palettes independent', () => {
      const first = serializedNodesToCode(nodes, {
        variablesMode: 'css-var',
        variables,
      });
      const second = serializedNodesToCode(nodes, {
        variablesMode: 'css-var',
        variables: {
          'color.bg': { type: 'color', value: '#121212' },
        },
      });
      const firstScope = first.match(
        /className="(ic-codegen-vars-[a-z0-9]+)"/,
      )?.[1];
      const secondScope = second.match(
        /className="(ic-codegen-vars-[a-z0-9]+)"/,
      )?.[1];
      expect(firstScope).toBeDefined();
      expect(secondScope).toBeDefined();
      expect(firstScope).not.toBe(secondScope);
      expect(first).toContain(
        `.${firstScope}{display:contents;--color-bg:#FFFFFF}`,
      );
      expect(second).toContain(
        `.${secondScope}{display:contents;--color-bg:#121212}`,
      );
    });

    it('provides CSS variables to reusable components rendered on their own', () => {
      const componentNodes = [
        {
          id: 'card',
          type: 'rect',
          name: 'ColorCard',
          x: 0,
          y: 0,
          zIndex: 0,
          width: 100,
          height: 100,
          reusable: true,
          fills: [{ type: 'solid', value: '$color.bg' }],
        },
        {
          id: 'card-instance',
          type: 'ref',
          ref: 'card',
          x: 0,
          y: 0,
          zIndex: 1,
        },
      ] as SerializedNode[];
      const code = serializedNodesToCode(componentNodes, {
        variablesMode: 'css-var',
        variables,
      });
      const scope = code.match(/function (IcDesignTokens_[a-z0-9]+)\(/)?.[1];
      expect(scope).toBeDefined();
      expect(code).toContain(
        `export function ColorCard() {\n  return (\n    <${scope}>`,
      );
      expect(code).toContain(
        `export function Design() {\n  return (\n    <${scope}>`,
      );
      expect(code).toContain('<style>');
    });

    it('preserve-token mode keeps $token via inline style', () => {
      const code = serializedNodesToCode(nodes, {
        variablesMode: 'preserve-token',
        variables,
      });
      expect(code).toContain('$color.bg');
      expect(code).toContain('style={{');
    });
  });

  describe('components and instances (preserve mode)', () => {
    const graph: SerializedNode[] = [
      {
        id: 'round-button',
        type: 'g',
        reusable: true,
        name: 'RoundButton',
        x: 0,
        y: 0,
        width: 120,
        height: 40,
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cornerRadius: 9999,
      } as SerializedNode,
      {
        id: 'label',
        parentId: 'round-button',
        type: 'text',
        name: 'label',
        x: 0,
        y: 0,
        zIndex: 1,
        content: 'Submit',
        fills: [{ type: 'solid', value: '#000000', opacity: 1 }],
      } as SerializedNode,
      {
        id: 'save-btn',
        type: 'ref',
        ref: 'round-button',
        x: 0,
        y: 0,
        zIndex: 2,
        descendants: {
          label: { content: 'Save' },
        },
      } as unknown as SerializedNode,
    ];

    it('emits a component definition and an instance with prop override', () => {
      const code = serializedNodesToCode(graph, {
        framework: 'react-tailwind',
        componentStructure: 'preserve',
      });
      // component def
      expect(code).toContain('export function RoundButton(');
      expect(code).toContain('interface RoundButtonProps');
      // default from template
      expect(code).toContain('"Submit"');
      // text bound to prop, not a literal
      expect(code).toContain('{label}');
      // instance call with overridden prop
      expect(code).toContain('<RoundButton');
      expect(code).toContain('label="Save"');
    });

    it('flatten mode expands instance into concrete DOM (no component)', () => {
      const code = serializedNodesToCode(graph, {
        framework: 'react-tailwind',
        componentStructure: 'flatten',
      });
      expect(code).not.toContain('export function RoundButton(');
      expect(code).not.toContain('<RoundButton');
      // 实例被展开为具体 DOM：保留 flex 容器与圆角
      expect(code).toContain('<div');
      expect(code).toContain('flex');
      expect(code).toContain('rounded-[9999px]');
      expect(code).toContain('<span');
      // overridden text rendered inline
      expect(code).toContain('Save');
      expect(code).not.toContain('Submit');
    });
  });

  describe('html-css emitter', () => {
    it('emits semantic controls and landmarks when node ids are annotated', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'page',
          type: 'rect',
          x: 0,
          y: 0,
          width: 320,
          height: 200,
          zIndex: 1,
          display: 'flex',
        } as SerializedNode,
        {
          id: 'title',
          parentId: 'page',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 2,
          content: 'Checkout',
        } as SerializedNode,
        {
          id: 'pay',
          parentId: 'page',
          type: 'rect',
          x: 0,
          y: 0,
          width: 120,
          height: 40,
          zIndex: 3,
          display: 'flex',
          fills: [{ type: 'solid', value: '#455ee6' }],
        } as SerializedNode,
        {
          id: 'help',
          parentId: 'page',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 4,
          content: 'Help',
        } as SerializedNode,
      ];
      const semanticElements = {
        page: { tag: 'main' as const },
        title: { tag: 'h1' as const },
        pay: { tag: 'button' as const },
        help: { tag: 'a' as const, href: '/help?topic=pay&lang=en' },
      };
      const html = serializedNodesToCode(nodes, {
        framework: 'html-css',
        semanticElements,
      });
      expect(html).toContain('<main');
      expect(html).toContain('<h1 style="margin: 0; flex-shrink: 0;');
      expect(html).toContain('line-height: 1.20">Checkout</h1>');
      expect(html).toContain('<button type="button"');
      expect(html).toContain('appearance: none; border: 0; padding: 0');
      expect(html).toContain('href="/help?topic=pay&amp;lang=en"');
      const react = serializedNodesToCode(nodes, { semanticElements });
      expect(react).toContain('<main');
      expect(react).toContain('<h1 className="shrink-0 whitespace-pre"');
      expect(react).toContain('lineHeight: 1.20 }}>Checkout</h1>');
      expect(react).toContain('<button type="button"');
      expect(react).toContain('href="/help?topic=pay&lang=en"');
    });

    it('keeps literal prices in generated text', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'price',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 1,
          content: '$48,295',
        } as SerializedNode,
      ];
      expect(
        serializedNodesToCode(nodes, {
          framework: 'html-css',
          variablesMode: 'css-var',
        }),
      ).toContain('$48,295');
      expect(
        serializedNodesToCode(nodes, { framework: 'react-tailwind' }),
      ).toContain('$48,295');
    });

    it('resolves text variables on nodes and reusable instance overrides', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'title',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 0,
          content: '$copy.title',
        } as SerializedNode,
        {
          id: 'price',
          type: 'text',
          x: 0,
          y: 20,
          zIndex: 1,
          content: '$29',
        } as SerializedNode,
        {
          id: 'button-template',
          type: 'rect',
          x: 0,
          y: 0,
          zIndex: 1,
          width: 120,
          height: 40,
          reusable: true,
        } as SerializedNode,
        {
          id: 'button-label',
          parentId: 'button-template',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 2,
          content: 'Default',
        } as SerializedNode,
        {
          id: 'button-instance',
          type: 'ref',
          ref: 'button-template',
          x: 0,
          y: 0,
          zIndex: 3,
          descendants: { 'button-label': { content: '$copy.action' } },
        } as SerializedNode,
      ];
      const variables = {
        'copy.title': { type: 'string' as const, value: 'Welcome' },
        'copy.action': { type: 'string' as const, value: 'Continue' },
      };
      for (const framework of ['html-css', 'react-tailwind'] as const) {
        for (const variablesMode of ['resolved', 'css-var'] as const) {
          const code = serializedNodesToCode(nodes, {
            framework,
            variablesMode,
            variables,
          });
          expect(code).toContain('Welcome');
          expect(code).toContain('Continue');
          expect(code).toContain('$29');
          expect(code).not.toContain('$copy.title');
          expect(code).not.toContain('$copy.action');
        }
      }
      const preserved = serializedNodesToCode(nodes, {
        variablesMode: 'preserve-token',
        variables,
      });
      expect(preserved).toContain('$copy.title');
      expect(preserved).toContain('$copy.action');
    });

    it('emits inline-styled html with iconify web component', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'box',
          type: 'rect',
          x: 0,
          y: 0,
          width: 200,
          height: 80,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fills: [{ type: 'solid', value: '#eee', opacity: 1 }],
        } as SerializedNode,
        {
          id: 'i',
          parentId: 'box',
          type: 'iconfont',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          zIndex: 1,
          iconFontName: 'search',
          iconFontFamily: 'lucide',
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(code).toContain('<div style="');
      expect(code).toContain('display: flex');
      expect(code).toContain('background-color: #eee');
      expect(code).toContain('<iconify-icon icon="lucide:search"');
    });

    it('css-var mode injects :root block', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'r1',
          type: 'rect',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          zIndex: 1,
          fills: [{ type: 'solid', value: '$color.bg', opacity: 1 }],
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes, {
        framework: 'html-css',
        variablesMode: 'css-var',
        variables: { 'color.bg': { type: 'color', value: '#fff' } },
      });
      expect(code).toContain(':root{');
      expect(code).toContain('--color-bg:#fff');
      expect(code).toContain('var(--color-bg)');
    });
  });

  describe('buildCodeIR', () => {
    it('lets serialized zero-size flex containers grow around their children', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'card',
          type: 'rect',
          x: 0,
          y: 0,
          width: 200,
          height: 0,
          zIndex: 1,
          display: 'flex',
          gap: 8,
        } as SerializedNode,
        {
          id: 'title',
          parentId: 'card',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 1,
          content: 'Shipping address',
        } as SerializedNode,
        {
          id: 'empty',
          type: 'rect',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          zIndex: 2,
        } as SerializedNode,
      ];
      const ir = buildCodeIR(nodes);
      expect(ir.roots[0].style).toMatchObject({ width: 200, gap: 8 });
      expect(ir.roots[0].style.height).toBeUndefined();
      expect(ir.roots[1].style).toMatchObject({ width: 0, height: 0 });
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('width: 200px');
      expect(html).toContain('<div style="width: 0px; height: 0px"></div>');
      expect(html).not.toContain('width: 200px; height: 0px');
    });

    it('produces a framework-agnostic tree with structured style', () => {
      const ir = buildCodeIR(
        [
          {
            id: 'r1',
            type: 'rect',
            x: 0,
            y: 0,
            width: 50,
            height: 50,
            zIndex: 1,
            cornerRadius: 4,
            fills: [{ type: 'solid', value: '#abc', opacity: 1 }],
          } as SerializedNode,
        ],
        {},
      );
      expect(ir.roots).toHaveLength(1);
      const root = ir.roots[0];
      expect(root.role).toBe('container');
      expect(root.style.width).toBe(50);
      expect(root.style.backgroundColor).toEqual({ literal: '#abc' });
      expect(root.style.borderRadius).toEqual({ literal: 4 });
    });
  });
});
