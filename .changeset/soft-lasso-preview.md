---
'@infinite-canvas-tutorial/lasso': patch
'@infinite-canvas-tutorial/ecs': patch
---

Preview lasso selection hits while drawing, update outlines as the path changes,
and clear previews on cancellation or tool changes. Commit selection once on
release. Highlight updates now patch only highlight state, avoiding unrelated
theme component writes during interactive previews.

Anchor lasso, marquee, and snapping overlays to the canvas viewport so switching
from lasso to rectangular selection does not displace the visible selection box.
