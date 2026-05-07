export { EcsGPUParticle } from './EcsGPUParticle';
export type {
  EcsGPUParticleInit,
  EcsParticleMouse,
} from './EcsGPUParticle';
export { EcsSineParticle } from './EcsSineParticle';
export type { EcsSineParticleOptions } from './EcsSineParticle';
export { EcsMeshParticle } from './EcsMeshParticle';
export type { EcsMeshParticleOptions } from './EcsMeshParticle';
export {
  loadMeshTriangleSoupFromFile,
  DEFAULT_MESH_SAMPLE_COUNT,
} from './meshSurfaceSample';
export type {
  MeshTriangleSoup,
  MeshSurfaceSampleResult,
} from './meshSurfaceSample';
export { EcsSpectrumParticleAudio } from './EcsSpectrumParticleAudio';
export type { EcsSpectrumParticleAudioOptions } from './EcsSpectrumParticleAudio';

/** Stable node id for the demo rect that receives the particle texture. */
export const SPECTRUM_PARTICLE_RECT_ID = 'spectrum-gpu-particles-sine';

/** Demo rect for mesh-sampled GPU particles. */
export const SPECTRUM_PARTICLE_MESH_RECT_ID = 'spectrum-gpu-particles-mesh';
