/** Responsive handoff styles for the three lesson 38 sample layouts. */
export function responsiveStarterCss(sceneId: string): string {
  const base = `.ic-starter {
  min-height: 100vh;
  width: 100%;
  overflow-x: auto;
}
.ic-starter > * { margin-inline: auto; }
`;
  switch (sceneId) {
    case 'dashboard':
      return `${base}
@media (max-width: 760px) {
  .ic-starter--dashboard > div { width: 100%; height: auto; flex-direction: column; }
  .ic-starter--dashboard aside { width: 100%; height: auto; padding: 16px; gap: 16px; }
  .ic-starter--dashboard aside nav { flex-direction: row; flex-wrap: wrap; }
  .ic-starter--dashboard aside nav > div { width: auto; }
  .ic-starter--dashboard aside > div { max-width: 100%; }
  .ic-starter--dashboard main { width: 100%; padding: 16px; }
  .ic-starter--dashboard main > * { width: 100%; }
  .ic-starter--dashboard main > header,
  .ic-starter--dashboard main > footer { flex-wrap: wrap; gap: 12px; }
  .ic-starter--dashboard main > header span { white-space: normal; }
  .ic-starter--dashboard main > div { flex-wrap: wrap; }
  .ic-starter--dashboard main > div:first-of-type > div { width: 100%; height: auto; min-height: 126px; }
  .ic-starter--dashboard main > div:nth-of-type(2) > div,
  .ic-starter--dashboard main > div:nth-of-type(2) > section { width: 100%; height: auto; }
  .ic-starter--dashboard main > div:nth-of-type(2) > div > div { width: 100%; }
  .ic-starter--dashboard main > div:nth-of-type(2) > div > div:first-of-type { gap: 8px; }
  .ic-starter--dashboard main > div:nth-of-type(2) > div > div:first-of-type > div { width: auto; min-width: 0; flex: 1 1 0; }
}
`;
    case 'pricing':
      return `${base}
@media (max-width: 700px) {
  .ic-starter--pricing > div { width: 100%; height: auto; padding: 24px 16px; gap: 36px; }
  .ic-starter--pricing > div > * { width: 100%; }
  .ic-starter--pricing nav { flex-wrap: wrap; gap: 16px; }
  .ic-starter--pricing nav > div { flex-wrap: wrap; gap: 12px; max-width: 100%; }
  .ic-starter--pricing header { text-align: center; }
  .ic-starter--pricing header h1 { font-size: clamp(26px, 7vw, 38px); }
  .ic-starter--pricing header span,
  .ic-starter--pricing header h1,
  .ic-starter--pricing footer span { white-space: normal; }
  .ic-starter--pricing section { flex-direction: column; align-items: center; }
  .ic-starter--pricing section > div,
  .ic-starter--pricing section > div > div { width: min(100%, 316px); }
  .ic-starter--pricing section > div > div { height: auto; min-height: 354px; }
  .ic-starter--pricing section button { width: 100%; }
  .ic-starter--pricing section span { white-space: normal; }
}
`;
    case 'checkout':
      return `${base}
@media (max-width: 390px) {
  .ic-starter--checkout > main { width: 100%; height: auto; min-height: 100vh; padding: 16px; }
  .ic-starter--checkout main > * { max-width: 100%; }
  .ic-starter--checkout main span { white-space: normal; }
  .ic-starter--checkout main > div:first-of-type > div { width: 67%; }
  .ic-starter--checkout main > div:nth-of-type(3) { height: auto; min-height: 125px; }
  .ic-starter--checkout main > div:nth-of-type(3) > div:first-child { width: 72px; height: 72px; }
  .ic-starter--checkout main > div:nth-of-type(3) > div:last-child { width: auto; min-width: 0; flex: 1; }
  .ic-starter--checkout main > section { height: auto; }
  .ic-starter--checkout main > section > div { width: 100%; gap: 8px; }
}
`;
    default:
      return base;
  }
}
