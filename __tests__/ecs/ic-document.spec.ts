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

  it('builds the four interchange sections from state', () => {
    const base = getDefaultAppState();
    const doc = buildIcDocumentFromState(
      base,
      [
        {
          id: 'rect-1',
          type: 'rect',
          x: 1,
          y: 2,
          width: 3,
          height: 4,
        } as RectSerializedNode,
      ],
      'https://example.com',
    );

    // The interchange format must expose variables / themes / elements / appState.
    expect(doc).toHaveProperty('variables');
    expect(doc).toHaveProperty('themes');
    expect(doc).toHaveProperty('elements');
    expect(doc).toHaveProperty('appState');

    // `theme` is split out into `themes`; it must not leak back into `appState`.
    expect(doc.themes.mode).toBe(base.theme.mode);
    expect((doc.appState as Record<string, unknown>).theme).toBeUndefined();
    expect((doc.appState as Record<string, unknown>).variables).toBeUndefined();

    // Elements are cloned, not shared by reference.
    expect(doc.elements[0].id).toBe('rect-1');

    // Themes and elements survive a stringify/parse roundtrip.
    const parsed = parseIcDocumentJson(stringifyIcDocument(doc));
    expect(parsed.themes.mode).toBe(doc.themes.mode);
    expect(parsed.elements[0].id).toBe('rect-1');
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

  it('parseIcDocumentJson validates each required section', () => {
    const valid = {
      type: IC_DOCUMENT_TYPE,
      version: IC_SCHEMA_VERSION,
      variables: {},
      themes: {},
      elements: [],
      appState: {},
    };
    expect(() =>
      parseIcDocumentJson({ ...valid, variables: 1 }),
    ).toThrow(/"variables" must be an object/);
    expect(() =>
      parseIcDocumentJson({ ...valid, themes: [] }),
    ).toThrow(/"themes" must be an object/);
    expect(() =>
      parseIcDocumentJson({ ...valid, elements: {} }),
    ).toThrow(/"elements" must be an array/);
    expect(() =>
      parseIcDocumentJson({ ...valid, appState: 'no' }),
    ).toThrow(/"appState" must be an object/);
    expect(() => parseIcDocumentJson(valid)).not.toThrow();
  });
});
