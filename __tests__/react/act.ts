import * as React from 'react';
import { act as legacyAct } from 'react-dom/test-utils';

// React 18.2 exposes act through react-dom/test-utils; newer React exports it.
export const act = React.act ?? legacyAct;
