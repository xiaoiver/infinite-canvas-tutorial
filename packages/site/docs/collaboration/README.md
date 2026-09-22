# Collaboration examples

The Yjs, Liveblocks, PerfectCursors, CommentsOverlay and Loro examples share
`bindDocument`. It reads the latest merged document at the next ECS frame,
including updates received before READY, and applies full snapshots with
`API.replaceDocument`. Unbinding removes subscriptions and cancels queued reads.

The v2 schema stores attribute maps under stable node IDs (`nodes-v2`). `__order`
is ordering metadata, not node identity. Local writes compare against the last
canvas snapshot, so unseen remote inserts and unrelated attribute changes are
preserved. Deletions and removed attributes are explicit; version counters are
not used as the sole equality check. Orphaned/cyclic parent links caused by
concurrent edits are projected deterministically as roots, preserving shapes.

Yjs can import a legacy `nodes` array already present when the adapter is created.
All clients in a room should use v2 together: old positional clients do not
understand the new schema. Standalone demos use v2 BroadcastChannel names; Loro
uses the `loro-canvas-v2` storage key and leaves the old `store` value untouched.

Standalone demos import identical immutable seed operations using reserved actor
ID 1. User edits use each document's random actor ID. Thus a newly opened tab
cannot resurrect the initial rectangle after another replica deleted it. These
seed operations must not be changed in place; a future seed change needs a new
schema/channel/storage version.
