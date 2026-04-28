import {
  shiftPath,
  transformPath,
} from '../../packages/ecs/src/utils/serialize/transform';
import { mat3 } from 'gl-matrix';

describe('shiftPath', () => {
  it('should shift M command', () => {
    const result = shiftPath('M 10 20', 5, 10);
    expect(result).toContain('M');
    expect(result).toContain('15');
    expect(result).toContain('30');
  });

  it('should shift L command', () => {
    const result = shiftPath('M 0 0 L 10 20', 5, 5);
    expect(result).toContain('L');
    expect(result).toContain('15');
    expect(result).toContain('25');
  });

  it('should shift H command', () => {
    const result = shiftPath('M 0 0 H 100', 10, 0);
    expect(result).toContain('H');
    expect(result).toContain('110');
  });

  it('should not shift H command when dy is 0', () => {
    const result = shiftPath('M 0 0 H 100', 0, 5);
    expect(result).toContain('H');
    expect(result).toContain('100');
  });

  it('should shift V command', () => {
    const result = shiftPath('M 0 0 V 100', 0, 10);
    expect(result).toContain('V');
    expect(result).toContain('110');
  });

  it('should not shift V command when dx is 0', () => {
    const result = shiftPath('M 0 0 V 100', 5, 0);
    expect(result).toContain('V');
    expect(result).toContain('100');
  });

  it('should shift C command (cubic bezier)', () => {
    const result = shiftPath('M 0 0 C 10 10 20 20 30 30', 5, 5);
    expect(result).toContain('C');
    // All control points and end point should be shifted
    expect(result).toContain('15');
    expect(result).toContain('35');
  });

  it('should shift Q command (quadratic bezier)', () => {
    const result = shiftPath('M 0 0 Q 10 10 20 20', 5, 5);
    expect(result).toContain('Q');
    expect(result).toContain('15');
    expect(result).toContain('25');
  });

  it('should shift S command (smooth cubic)', () => {
    const result = shiftPath('M 0 0 S 10 10 20 20', 5, 5);
    expect(result).toContain('S');
    expect(result).toContain('15');
    expect(result).toContain('25');
  });

  it('should shift T command (smooth quadratic)', () => {
    const result = shiftPath('M 0 0 Q 10 10 20 20 T 30 30', 5, 5);
    expect(result).toContain('T');
    expect(result).toContain('35');
  });

  it('should shift A command (arc)', () => {
    const result = shiftPath('M 0 0 A 10 10 0 0 0 50 50', 5, 5);
    expect(result).toContain('A');
    expect(result).toContain('55');
  });

  it('should handle complex path with multiple commands', () => {
    const d = 'M 10 10 L 50 10 L 50 50 L 10 50 Z';
    const result = shiftPath(d, 5, 5);
    expect(result).toContain('M');
    expect(result).toContain('L');
    expect(result).toContain('Z');
  });

  it('should handle path with no shift (dx=0, dy=0)', () => {
    const d = 'M 10 20 L 30 40';
    const result = shiftPath(d, 0, 0);
    expect(result).toContain('10');
    expect(result).toContain('20');
    expect(result).toContain('30');
    expect(result).toContain('40');
  });

  it('should handle negative shift values', () => {
    const result = shiftPath('M 10 10', -5, -5);
    expect(result).toContain('5');
  });

  it('should handle relative path converted to absolute', () => {
    const d = 'm 10 10 l 20 0';
    const result = shiftPath(d, 5, 5);
    // The path should be converted to absolute and shifted
    expect(result).toBeTruthy();
  });
});

describe('transformPath', () => {
  it('should transform M command', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [10, 20]);
    const result = transformPath('M 0 0', matrix);
    expect(result).toContain('10');
    expect(result).toContain('20');
  });

  it('should transform L command', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [5, 5]);
    const result = transformPath('M 0 0 L 10 10', matrix);
    expect(result).toContain('15');
  });

  it('should transform H command', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [10, 0]);
    const result = transformPath('M 0 0 H 100', matrix);
    expect(result).toContain('110');
  });

  it('should transform V command', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [0, 10]);
    const result = transformPath('M 0 0 V 100', matrix);
    expect(result).toContain('110');
  });

  it('should transform T command', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [5, 5]);
    const result = transformPath('M 0 0 Q 10 10 20 20 T 30 30', matrix);
    expect(result).toContain('T');
    expect(result).toContain('35');
  });

  it('should transform A command', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [5, 5]);
    const result = transformPath('M 0 0 A 10 10 0 0 0 50 50', matrix);
    expect(result).toContain('A');
    expect(result).toContain('55');
  });

  it('should scale elliptical arc radii with linear transform (icon path scaling)', () => {
    const matrix = mat3.create();
    mat3.scale(matrix, matrix, [2, 2]);
    const result = transformPath('M 0 0 A 10 10 0 0 0 50 50', matrix);
    expect(result).toContain('A20 20');
    expect(result).toContain('100 100');
  });

  it('should transform C command (cubic bezier)', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [5, 5]);
    const result = transformPath('M 0 0 C 10 10 20 20 30 30', matrix);
    expect(result).toContain('C');
    expect(result).toContain('35');
  });

  it('should transform Q command (quadratic bezier)', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [5, 5]);
    const result = transformPath('M 0 0 Q 10 10 20 20', matrix);
    expect(result).toContain('Q');
    expect(result).toContain('25');
  });

  it('should transform S command (smooth cubic)', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [5, 5]);
    const result = transformPath('M 0 0 S 10 10 20 20', matrix);
    expect(result).toContain('S');
    expect(result).toContain('25');
  });

  it('should handle scale transformation', () => {
    const matrix = mat3.create();
    mat3.scale(matrix, matrix, [2, 2]);
    const result = transformPath('M 10 10 L 20 20', matrix);
    expect(result).toContain('20');
    expect(result).toContain('40');
  });

  it('should handle rotation transformation', () => {
    const matrix = mat3.create();
    mat3.rotate(matrix, matrix, Math.PI / 2); // 90 degrees
    const result = transformPath('M 10 0', matrix);
    // After 90 degree rotation, (10, 0) becomes (0, 10)
    expect(result).toContain('M');
  });

  it('should handle complex path with multiple commands', () => {
    const matrix = mat3.create();
    mat3.translate(matrix, matrix, [10, 10]);
    const d = 'M 0 0 L 50 0 L 50 50 L 0 50 Z';
    const result = transformPath(d, matrix);
    expect(result).toContain('M');
    expect(result).toContain('L');
    expect(result).toContain('Z');
  });

  it('should handle identity matrix (no transformation)', () => {
    const matrix = mat3.create(); // Identity matrix
    const d = 'M 10 20 L 30 40';
    const result = transformPath(d, matrix);
    expect(result).toContain('10');
    expect(result).toContain('20');
    expect(result).toContain('30');
    expect(result).toContain('40');
  });
});
