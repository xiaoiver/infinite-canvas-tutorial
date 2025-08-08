import { DOMAdapter, measureText } from '../../packages/ecs/src';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Measure text', () => {
  it('should measure text with default style correctly', () => {
    const content = 'Text';
    const computed = measureText({
      content,
      fontFamily: 'sans-serif',
      fontSize: 16,
    });

    expect(computed.font).toEqual('normal normal normal 16px sans-serif');
    expect(computed.lines).toEqual(['Text']);
    expect(computed.height).toBeGreaterThan(16);
    expect(computed.lineMetrics?.length).toEqual(1);
  });

  it('should measure text with custom style correctly', () => {
    const content = 'Text';
    const computed = measureText({
      content,
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontVariant: 'normal',
    });

    expect(computed.font).toEqual('italic normal 700 16px sans-serif');
    expect(computed.lines).toEqual(['Text']);
  });

  it('should measure text with multiple lines correctly', () => {
    const content = 'Hello\nworld';
    const computed = measureText({
      content,
      fontFamily: 'sans-serif',
      fontSize: 16,
    });

    expect(computed.font).toEqual('normal normal normal 16px sans-serif');
    expect(computed.lines).toEqual(['Hello', 'world']);
  });
});
