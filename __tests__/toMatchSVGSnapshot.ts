import * as path from 'path';
import * as fs from 'fs';
import xmlserializer from 'xmlserializer';
import { format } from 'prettier';

export type ToMatchSVGSnapshotOptions = {
  fileFormat?: string;
};

// @see https://jestjs.io/docs/26.x/expect#expectextendmatchers
export function toMatchSVGSnapshot(
  dom: SVGElement | null,
  dir: string,
  name: string,
  options: ToMatchSVGSnapshotOptions = {},
): { message: () => string; pass: boolean } {
  const { fileFormat = 'svg' } = options;
  const namePath = path.join(dir, name);
  const actualPath = path.join(dir, `${name}-actual.${fileFormat}`);
  const expectedPath = path.join(dir, `${name}.${fileFormat}`);

  let actual: string;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    actual = dom
      ? format(xmlserializer.serializeToString(dom), {
          parser: 'babel',
        })
      : 'null';

    // Remove ';' after format by babel.
    if (actual !== 'null') actual = actual.slice(0, -2);

    if (!fs.existsSync(expectedPath)) {
      if (process.env.CI === 'true') {
        throw new Error(`Please generate golden image for ${namePath}`);
      }
      console.warn(`! generate ${namePath}`);
      fs.writeFileSync(expectedPath, actual);
      return {
        message: () => `generate ${namePath}`,
        pass: true,
      };
    } else {
      const expected = fs.readFileSync(expectedPath, {
        encoding: 'utf8',
        flag: 'r',
      });
      if (actual === expected) {
        if (fs.existsSync(actualPath)) fs.unlinkSync(actualPath);
        return {
          message: () => `match ${namePath}`,
          pass: true,
        };
      }

      // Perverse actual file.
      if (actual) fs.writeFileSync(actualPath, actual);
      return {
        message: () => `mismatch ${namePath}`,
        pass: false,
      };
    }
  } catch (e) {
    return {
      message: () => `${e}`,
      pass: false,
    };
  }
}
