import {
  buildIcDocumentFromState,
  parseIcDocumentJson,
  stringifyIcDocument,
  IC_DOCUMENT_TYPE,
  IC_SCHEMA_VERSION,
  getDefaultAppState,
  type RectSerializedNode,
} from '../../packages/ecs/src';

describe('IC document', () => {
  it('parse ↔ stringify roundtrip', () => {
    const base = getDefaultAppState();
    const doc = buildIcDocumentFromState(
      base,
      [
        {
          id: 'a',
          type: 'rect',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          fills: [{ type: 'solid', value: 'red', opacity: 1 }],
        } as RectSerializedNode,
      ],
      'https://example.com',
    );
    doc.variables = {
      'color.bg': { type: 'color', value: '#111' },
    };
    doc.appState = { ...doc.appState, language: 'zh', cameraZoom: 2 };

    const str = stringifyIcDocument(doc);
    const parsed = parseIcDocumentJson(str);
    expect(parsed.type).toBe(IC_DOCUMENT_TYPE);
    expect(parsed.version).toBe(IC_SCHEMA_VERSION);
    expect(parsed.elements[0].id).toBe('a');
    expect(parsed.variables['color.bg']?.value).toBe('#111');
    expect(parsed.appState.language).toBe('zh');
  });

  it('parseIcDocumentJson rejects invalid payloads', () => {
    expect(() => parseIcDocumentJson(null)).toThrow(/JSON object/);
    expect(() => parseIcDocumentJson('[]')).toThrow(/JSON object/);
    expect(() =>
      parseIcDocumentJson({ type: 'wrong', version: 1 }),
    ).toThrow(/Invalid IC document type/);
    expect(() =>
      parseIcDocumentJson({
        type: IC_DOCUMENT_TYPE,
        version: 999,
        variables: {},
        themes: {},
        elements: [],
        appState: {},
      }),
    ).toThrow(/Unsupported IC schema version/);
  });
});
