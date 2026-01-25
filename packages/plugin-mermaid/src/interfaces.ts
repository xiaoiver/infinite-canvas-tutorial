import { IPointData } from "@infinite-canvas-tutorial/ecs";

export enum VERTEX_TYPE {
  ROUND = "round",
  STADIUM = "stadium",
  DOUBLECIRCLE = "doublecircle",
  CIRCLE = "circle",
  DIAMOND = "diamond",
}
export enum LABEL_STYLE_PROPERTY {
  COLOR = "color",
}
export enum CONTAINER_STYLE_PROPERTY {
  FILL = "fill",
  STROKE = "stroke",
  STROKE_WIDTH = "stroke-width",
  STROKE_DASHARRAY = "stroke-dasharray",
}
export interface Vertex {
  id: string;
  type: VERTEX_TYPE;
  labelType: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  link?: string;
  containerStyle: { [key in CONTAINER_STYLE_PROPERTY]?: string };
  labelStyle: { [key in LABEL_STYLE_PROPERTY]?: string };
}

export interface Edge {
  id?: string;
  start: string;
  end: string;
  type: string;
  text: string;
  labelType: string;
  stroke: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  reflectionPoints: IPointData[];
}

export interface ParsedMermaidData {
  type: "flowchart";
  vertices: Map<string, Vertex>;
  edges: Edge[];
}