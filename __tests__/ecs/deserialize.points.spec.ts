import {
  deserializePoints,
  deserializeBrushPoints,
} from '../../packages/ecs/src/utils/deserialize/points';

describe('deserializePoints', () => {
  it('should parse space-separated points', () => {
    const result = deserializePoints('0,0 10,10 20,30');
    expect(result).toEqual([
      [0, 0],
      [10, 10],
      [20, 30],
    ]);
  });

  it('should parse comma-separated points without spaces', () => {
    const result = deserializePoints('0,0,10,10,20,30');
    expect(result).toEqual([
      [0, 0],
      [10, 10],
      [20, 30],
    ]);
  });

  it('should handle single point', () => {
    const result = deserializePoints('5,10');
    expect(result).toEqual([[5, 10]]);
  });

  it('should handle empty string', () => {
    const result = deserializePoints('');
    expect(result).toEqual([]);
  });

  it('should handle negative coordinates', () => {
    const result = deserializePoints('-10,-20 30,-40');
    expect(result).toEqual([
      [-10, -20],
      [30, -40],
    ]);
  });

  it('should handle decimal coordinates', () => {
    const result = deserializePoints('1.5,2.5 3.14,4.14');
    expect(result).toEqual([
      [1.5, 2.5],
      [3.14, 4.14],
    ]);
  });

  // it('should handle mixed format with leading/trailing spaces', () => {
  //   const result = deserializePoints('  0,0  10,10  ');
  //   expect(result).toEqual([
  //     [0, 0],
  //     [10, 10],
  //   ]);
  // });

  it('should handle odd number of coordinates by dropping last', () => {
    const result = deserializePoints('0,0,10,10,20');
    expect(result).toEqual([
      [0, 0],
      [10, 10],
    ]);
  });
});

describe('deserializeBrushPoints', () => {
  it('should parse brush points with radius', () => {
    const result = deserializeBrushPoints('0,0,5 10,10,8 20,30,3');
    expect(result).toEqual([
      { x: 0, y: 0, radius: 5 },
      { x: 10, y: 10, radius: 8 },
      { x: 20, y: 30, radius: 3 },
    ]);
  });

  it('should handle single brush point', () => {
    const result = deserializeBrushPoints('5,10,2');
    expect(result).toEqual([{ x: 5, y: 10, radius: 2 }]);
  });

  it('should handle empty string', () => {
    const result = deserializeBrushPoints('');
    expect(result).toEqual([{ x: 0, y: undefined, radius: undefined }]);
  });

  it('should handle negative coordinates', () => {
    const result = deserializeBrushPoints('-10,-20,5');
    expect(result).toEqual([{ x: -10, y: -20, radius: 5 }]);
  });

  it('should handle decimal values', () => {
    const result = deserializeBrushPoints('1.5,2.5,3.5');
    expect(result).toEqual([{ x: 1.5, y: 2.5, radius: 3.5 }]);
  });
});
