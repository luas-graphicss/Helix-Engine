import type { GlslChunk } from '../node-definition';
import { FBM_CHUNK, VALUE_NOISE_CHUNK } from './noise-chunks';
export const HOLOGRAM_CHUNK: GlslChunk = {
    name: 'sgHologram',
    source: `vec4 sgHologram(vec3 position, vec3 surfaceNormal, vec3 viewDirection, vec3 tint, float density, float speed, float time) {
  float rim = pow(1.0 - clamp(dot(surfaceNormal, viewDirection), 0.0, 1.0), 2.0);
  float scan = 0.5 + 0.5 * sin(position.y * density - time * speed * 6.2831853);
  float sweep = smoothstep(0.92, 1.0, fract(position.y * 0.35 - time * speed * 0.25));
  float flicker = 0.92 + 0.08 * sin(time * 43.0);
  float opacity = clamp(0.18 + rim * 0.9 + scan * 0.3 + sweep * 0.5, 0.0, 1.0) * flicker;
  vec3 glow = tint * (0.35 + rim * 1.8 + scan * 0.5 + sweep * 1.5);
  return vec4(glow, opacity);
}`,
};
export const WATER_CHUNK: GlslChunk = {
    name: 'sgWaterHeight',
    requires: [VALUE_NOISE_CHUNK],
    source: `float sgWaterHeight(vec2 p, float time) {
  float waves = sgValueNoise(p + vec2(time * 0.6, time * 0.35));
  waves += 0.5 * sgValueNoise(p * 2.3 - vec2(time * 0.45, time * 0.8));
  return waves / 1.5;
}`,
};
export const LAVA_CHUNK: GlslChunk = {
    name: 'sgLava',
    requires: [FBM_CHUNK],
    source: `vec2 sgLava(vec2 p, float time) {
  vec2 warp = vec2(sgFbm(p + vec2(time, -time * 0.7)), sgFbm(p + vec2(5.2 - time * 0.6, 1.3 + time)));
  float flow = sgFbm(p + warp * 1.6);
  float cracks = 1.0 - smoothstep(0.0, 0.22, abs(flow - 0.5));
  float heat = clamp(cracks * 1.15 + smoothstep(0.62, 0.9, flow) * 0.5, 0.0, 1.0);
  return vec2(heat, flow);
}`,
};
