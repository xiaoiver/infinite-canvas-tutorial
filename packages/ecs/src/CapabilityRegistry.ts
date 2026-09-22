import type { API } from './API';

export type CanvasCapabilities = Pick<
  API,
  | 'upload'
  | 'createOrEditImage'
  | 'encodeImage'
  | 'segmentImage'
  | 'decomposeImage'
  | 'upscaleImage'
  | 'removeByMask'
>;

/** Canvas-local providers. Ambiguity is explicit instead of registration-order dependent. */
export class CapabilityRegistry {
  private providers = new Map<keyof CanvasCapabilities, Map<string, unknown>>();
  private selected = new Map<keyof CanvasCapabilities, string>();
  private disposed = false;

  register<K extends keyof CanvasCapabilities>(
    name: K,
    provider: string,
    implementation: CanvasCapabilities[K],
  ): () => void {
    if (this.disposed)
      throw new Error('Canvas capabilities have been disposed');
    let providers = this.providers.get(name);
    if (!providers) this.providers.set(name, (providers = new Map()));
    if (providers.has(provider))
      throw new Error(`${name}: provider ${provider} is already registered`);
    providers.set(provider, implementation);
    return () => {
      if (providers.get(provider) === implementation)
        providers.delete(provider);
    };
  }

  /** May be called before plugins initialize. Selection never silently falls back. */
  select(name: keyof CanvasCapabilities, provider: string) {
    if (this.disposed)
      throw new Error('Canvas capabilities have been disposed');
    this.selected.set(name, provider);
  }

  list(name: keyof CanvasCapabilities): string[] {
    return [...(this.providers.get(name)?.keys() ?? [])];
  }

  get<K extends keyof CanvasCapabilities>(name: K): CanvasCapabilities[K] {
    if (this.disposed)
      throw new Error('Canvas capabilities have been disposed');
    const providers = this.providers.get(name);
    const selected = this.selected.get(name);
    if (selected) {
      if (!providers?.has(selected))
        throw new Error(`${name}: provider ${selected} is unavailable`);
      return providers.get(selected) as CanvasCapabilities[K];
    }
    if (!providers?.size) throw new Error(`${name}: no provider is registered`);
    if (providers.size > 1) {
      throw new Error(
        `${name}: multiple providers (${this.list(name).join(
          ', ',
        )}); select one with api.capabilities.select()`,
      );
    }
    return providers.values().next().value as CanvasCapabilities[K];
  }

  dispose() {
    this.disposed = true;
    this.providers.clear();
    this.selected.clear();
  }
}
