---
'@infinite-canvas-tutorial/react': patch
---

Copy node snapshots at the Provider store boundary and retain unchanged node references, so object selectors observe committed in-place API updates and node/selection hooks avoid repeated deep copies.
