/** Resolve a glTF-relative asset URI against the glTF file URL. */
export function resolveGltfAssetUrl(baseUrl: string, relative: string): string {
  if (
    relative.startsWith('data:') ||
    relative.startsWith('http://') ||
    relative.startsWith('https://') ||
    relative.startsWith('/')
  ) {
    return relative;
  }
  const base = baseUrl.replace(/[#?].*$/, '');
  const slash = base.lastIndexOf('/');
  const dir = slash >= 0 ? base.slice(0, slash + 1) : '';
  return dir + relative;
}
