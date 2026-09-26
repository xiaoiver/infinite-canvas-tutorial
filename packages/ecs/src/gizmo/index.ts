/**
 * PlayCanvas-style 3D transform gizmo building blocks.
 *
 * This module mirrors the structure of PlayCanvas' `extras/gizmo`:
 * - `constants` — axes, planes, spaces, drag modes
 * - `color` — axis colors and hover/disabled/lerp helpers
 * - `shape/` — a `GizmoShape` class hierarchy (Arrow / Plane / Torus / Box /
 *   Sphere), each owning its mesh + per-state colors
 * - `gizmos` — per-mode assemblers (translate / rotate / scale / transform)
 */
export * from './constants';
export * from './color';
export * from './gizmos';
export * from './shape/primitives';
export * from './shape/shape';
export * from './shape/arrow-shape';
export * from './shape/plane-shape';
export * from './shape/torus-shape';
export * from './shape/box-shape';
export * from './shape/sphere-shape';
