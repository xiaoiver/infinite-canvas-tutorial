import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/** Google 在 ads.txt 规范中使用的认证机构 ID（固定值）。 */
const GOOGLE_ADS_TXT_ACCOUNT_TYPE = 'f08c47fec0942fa0';

function parseAdsensePubId(client: string): string | null {
  const t = client.trim();
  const fromCa = t.match(/^ca-(pub-\d+)$/i);
  if (fromCa) return fromCa[1];
  if (/^pub-\d+$/i.test(t)) return t;
  return null;
}

function adsenseBuildEnabled(): boolean {
  return (
    process.env.ADSENSE_ENABLED === 'true' &&
    !!process.env.ADSENSE_CLIENT?.trim()
  );
}

/**
 * 在构建产物根目录写入 ads.txt（与 head 里的 AdSense 使用同一 ADSENSE_CLIENT）。
 * 需在构建环境中设置 ADSENSE_ENABLED=true 与 ADSENSE_CLIENT（例如 ca-pub-xxxxxxxxxxxxxxxx）。
 */
export function adsenseAdsTxtPlugin(): Plugin {
  let outDir = '';
  return {
    name: 'adsense-ads-txt',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    buildEnd(error) {
      if (error || !adsenseBuildEnabled() || !outDir) {
        return;
      }
      const client = process.env.ADSENSE_CLIENT!;
      const pub = parseAdsensePubId(client);
      if (!pub) {
        return;
      }
      const line = `google.com, ${pub}, DIRECT, ${GOOGLE_ADS_TXT_ACCOUNT_TYPE}\n`;
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'ads.txt'), line, 'utf8');
    },
  };
}
