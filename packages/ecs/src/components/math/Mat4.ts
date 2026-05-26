import { Type } from '@lastolivegames/becsy';
import { mat4 as glMat4 } from 'gl-matrix';

/**
 * A 4x4 column major matrix for 3D transformations.
 * @see https://glmatrix.net/docs/module-mat4.html
 */
export class Mat4 {
  static IDENTITY = Mat4.fromArray([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);

  static fromArray(m: number[]) {
    return new Mat4(
      m[0],
      m[1],
      m[2],
      m[3],
      m[4],
      m[5],
      m[6],
      m[7],
      m[8],
      m[9],
      m[10],
      m[11],
      m[12],
      m[13],
      m[14],
      m[15],
    );
  }

  static fromGLMat4(m: glMat4) {
    return Mat4.fromArray(m as unknown as number[]);
  }

  static toGLMat4(m: Mat4): glMat4 {
    return glMat4.fromValues(
      m.m00,
      m.m01,
      m.m02,
      m.m03,
      m.m10,
      m.m11,
      m.m12,
      m.m13,
      m.m20,
      m.m21,
      m.m22,
      m.m23,
      m.m30,
      m.m31,
      m.m32,
      m.m33,
    );
  }

  /**
   * Creates a perspective projection matrix.
   */
  static perspective(fovy: number, aspect: number, near: number, far: number) {
    const out = glMat4.create();
    glMat4.perspective(out, fovy, aspect, near, far);
    return Mat4.fromGLMat4(out);
  }

  /**
   * Creates a look-at view matrix.
   */
  static lookAt(
    eye: [number, number, number],
    center: [number, number, number],
    up: [number, number, number],
  ) {
    const out = glMat4.create();
    glMat4.lookAt(out, eye, center, up);
    return Mat4.fromGLMat4(out);
  }

  /**
   * Multiplies two 4x4 matrices.
   */
  static multiply(a: Mat4, b: Mat4) {
    const out = glMat4.create();
    glMat4.multiply(out, Mat4.toGLMat4(a), Mat4.toGLMat4(b));
    return Mat4.fromGLMat4(out);
  }

  /**
   * Returns the Float32Array representation (column-major).
   */
  toFloat32Array(): Float32Array {
    return new Float32Array([
      this.m00,
      this.m01,
      this.m02,
      this.m03,
      this.m10,
      this.m11,
      this.m12,
      this.m13,
      this.m20,
      this.m21,
      this.m22,
      this.m23,
      this.m30,
      this.m31,
      this.m32,
      this.m33,
    ]);
  }

  m00: number;
  m01: number;
  m02: number;
  m03: number;
  m10: number;
  m11: number;
  m12: number;
  m13: number;
  m20: number;
  m21: number;
  m22: number;
  m23: number;
  m30: number;
  m31: number;
  m32: number;
  m33: number;

  constructor(
    m00 = 0,
    m01 = 0,
    m02 = 0,
    m03 = 0,
    m10 = 0,
    m11 = 0,
    m12 = 0,
    m13 = 0,
    m20 = 0,
    m21 = 0,
    m22 = 0,
    m23 = 0,
    m30 = 0,
    m31 = 0,
    m32 = 0,
    m33 = 0,
  ) {
    this.m00 = m00;
    this.m01 = m01;
    this.m02 = m02;
    this.m03 = m03;
    this.m10 = m10;
    this.m11 = m11;
    this.m12 = m12;
    this.m13 = m13;
    this.m20 = m20;
    this.m21 = m21;
    this.m22 = m22;
    this.m23 = m23;
    this.m30 = m30;
    this.m31 = m31;
    this.m32 = m32;
    this.m33 = m33;
  }
}

export const m4Type = Type.vector(
  Type.float32,
  [
    'm00',
    'm01',
    'm02',
    'm03',
    'm10',
    'm11',
    'm12',
    'm13',
    'm20',
    'm21',
    'm22',
    'm23',
    'm30',
    'm31',
    'm32',
    'm33',
  ],
  Mat4,
);
