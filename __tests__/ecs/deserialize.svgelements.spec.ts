import { JSDOM } from 'jsdom';
import {
  svgElementsToSerializedNodes,
  DOMAdapter,
} from '../../packages/ecs/src';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Deserialize SVGElements to SerializedNodes', () => {
  it('should convert <rect> correctly', () => {
    const dom = new JSDOM(
      `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect id="0" x="0" y="0" width="100" height="100" fill="red" />
    </svg>`,
    );
    const document = dom.window.document;
    const svg = document.querySelector('svg')!;
    const nodes = svgElementsToSerializedNodes(
      Array.from(svg.children) as SVGElement[],
    );
    expect(nodes).toEqual([
      {
        id: '0',
        parentId: undefined,
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        cornerRadius: 0,
        dropShadowColor: 'none',
        dropShadowOffsetX: 0,
        dropShadowOffsetY: 0,
        dropShadowBlurRadius: 0,
        innerShadowBlurRadius: 0,
        innerShadowColor: 'none',
        innerShadowOffsetX: 0,
        innerShadowOffsetY: 0,
        visibility: 'inherited',
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        fillOpacity: 1,
        fill: 'red',
        strokeOpacity: 1,
        stroke: 'none',
        strokeWidth: 1,
        strokeLinecap: 'butt',
        strokeLinejoin: 'miter',
        strokeAlignment: 'center',
        strokeMiterlimit: 4,
        strokeDasharray: '0,0',
        strokeDashoffset: 0,
        name: 'Layer 0',
        zIndex: 0,
      },
    ]);
  });

  it('should convert <ellipse> correctly', () => {
    const dom = new JSDOM(
      `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse id="0" cx="50" cy="50" rx="50" ry="50" fill="red" transform="matrix(1, 0, 0, 1, 50, 50)"/>
    </svg>`,
    );
    const document = dom.window.document;
    const svg = document.querySelector('svg')!;
    const nodes = svgElementsToSerializedNodes(
      Array.from(svg.children) as SVGElement[],
    );
    expect(nodes).toEqual([
      {
        id: '0',
        parentId: undefined,
        type: 'ellipse',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        visibility: 'inherited',
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        fillOpacity: 1,
        fill: 'red',
        strokeOpacity: 1,
        stroke: 'none',
        strokeWidth: 1,
        strokeLinecap: 'butt',
        strokeLinejoin: 'miter',
        strokeAlignment: 'center',
        strokeMiterlimit: 4,
        strokeDasharray: '0,0',
        strokeDashoffset: 0,
        name: 'Layer 0',
        zIndex: 0,
      },
    ]);
  });

  it('should convert <circle> correctly', () => {
    const dom = new JSDOM(
      `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle id="0" cx="50" cy="50" r="50" fill="red" transform="matrix(1, 0, 0, 1, 50, 50)"/>
    </svg>`,
    );
    const document = dom.window.document;
    const svg = document.querySelector('svg')!;
    const nodes = svgElementsToSerializedNodes(
      Array.from(svg.children) as SVGElement[],
    );
    expect(nodes).toEqual([
      {
        id: '0',
        parentId: undefined,
        type: 'ellipse',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        visibility: 'inherited',
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        fillOpacity: 1,
        fill: 'red',
        strokeOpacity: 1,
        stroke: 'none',
        strokeWidth: 1,
        strokeLinecap: 'butt',
        strokeLinejoin: 'miter',
        strokeAlignment: 'center',
        strokeMiterlimit: 4,
        strokeDasharray: '0,0',
        strokeDashoffset: 0,
        name: 'Layer 0',
        zIndex: 0,
      },
    ]);
  });

  it('should convert <polyline> correctly', () => {
    const dom = new JSDOM(
      `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polyline id="0" points="0,0 100,100 -100,100" stroke="red" fill="none" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="4" stroke-dasharray="0,0" stroke-dashoffset="0" />
    </svg>`,
    );
    const document = dom.window.document;
    const svg = document.querySelector('svg')!;
    const nodes = svgElementsToSerializedNodes(
      Array.from(svg.children) as SVGElement[],
    );
    expect(nodes).toEqual([
      {
        id: '0',
        parentId: undefined,
        type: 'polyline',
        points: '100,0 200,100 0,100',
        x: -100,
        y: 0,
        width: 200,
        height: 100,
        visibility: 'inherited',
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        fillOpacity: 1,
        fill: 'none',
        strokeOpacity: 1,
        stroke: 'red',
        strokeWidth: 10,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeAlignment: 'center',
        strokeMiterlimit: 4,
        strokeDasharray: '0,0',
        strokeDashoffset: 0,
        markerStart: 'none',
        markerEnd: 'none',
        markerFactor: 3,
        name: 'Layer 0',
        zIndex: 0,
      },
    ]);
  });

  it('should convert <path> correctly', () => {
    const dom = new JSDOM(
      `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path id="0" d="M 0 0 L 100 100 L -100 100" stroke="red" fill="black" fill-opacity="0.5" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="4" stroke-dasharray="10,10" stroke-dashoffset="10" />
    </svg>`,
    );
    const document = dom.window.document;
    const svg = document.querySelector('svg')!;
    const nodes = svgElementsToSerializedNodes(
      Array.from(svg.children) as SVGElement[],
    );
    expect(nodes).toEqual([
      {
        id: '0',
        parentId: undefined,
        type: 'path',
        d: 'M100 0L200 100L0 100',
        x: -100,
        y: 0,
        width: 200,
        height: 100,
        visibility: 'inherited',
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        fillOpacity: 0.5,
        fill: 'black',
        fillRule: 'nonzero',
        strokeOpacity: 1,
        stroke: 'red',
        strokeWidth: 10,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeAlignment: 'center',
        strokeMiterlimit: 4,
        strokeDasharray: '10,10',
        strokeDashoffset: 10,
        markerStart: 'none',
        markerEnd: 'none',
        markerFactor: 3,
        name: 'Layer 0',
        zIndex: 0,
      },
    ]);
  });
});
