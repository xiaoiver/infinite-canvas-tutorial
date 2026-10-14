---
'@infinite-canvas-tutorial/ecs': patch
---

Keep animation playback and timeline scrubbing independent across canvases sharing an ECS world. Resume only controllers paused by the editor, preserving caller-paused and cancelled states.

Apply animated paint and opacity together without discarding other paint layers. Preserve nonuniform gradient stops and hard color transitions, and retain endpoint order when morphing open paths. Ignore out-of-range keyframe removals without adding undo entries.
