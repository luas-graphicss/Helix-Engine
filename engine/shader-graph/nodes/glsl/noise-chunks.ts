import type { GlslChunk } from '../node-definition';
export const HASH_CHUNK: GlslChunk = {
    name: 'sgHash',
    source: `float sgHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
vec2 sgHash2(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}`,
};
export const VALUE_NOISE_CHUNK: GlslChunk = {
    name: 'sgValueNoise',
    requires: [HASH_CHUNK],
    source: `float sgValueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  float a = sgHash(cell);
  float b = sgHash(cell + vec2(1.0, 0.0));
  float c = sgHash(cell + vec2(0.0, 1.0));
  float d = sgHash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}`,
};
export const FBM_CHUNK: GlslChunk = {
    name: 'sgFbm',
    requires: [VALUE_NOISE_CHUNK],
    source: `float sgFbm(vec2 p) {
  float total = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 5; octave++) {
    total += amplitude * sgValueNoise(p);
    p = p * 2.02 + vec2(17.3, 9.1);
    amplitude *= 0.5;
  }
  return total / 0.96875;
}`,
};
export const VORONOI_CHUNK: GlslChunk = {
    name: 'sgVoronoi',
    requires: [HASH_CHUNK],
    source: `vec2 sgVoronoi(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float nearest = 8.0;
  float cellId = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      float reach = length(neighbor + sgHash2(cell + neighbor) - local);
      if (reach < nearest) {
        nearest = reach;
        cellId = sgHash(cell + neighbor);
      }
    }
  }
  return vec2(nearest, cellId);
}`,
};
