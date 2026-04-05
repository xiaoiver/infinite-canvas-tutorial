/** 将取色器产出的 solid 字符串安全写入节点：支持 `#`、`rgb`/`hsl`、裸十六进制与命名色。 */
export function normalizeSolidCssValue(value: string): string {
  const v = value.trim();
  if (/^(#|rgb|hsla?|color\()/i.test(v)) {
    return v;
  }
  if (/^[0-9a-fA-F]{3,8}$/.test(v)) {
    return `#${v}`;
  }
  return v;
}
