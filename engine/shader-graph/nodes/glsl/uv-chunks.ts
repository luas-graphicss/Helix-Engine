import type { GlslChunk } from '../node-definition';
export const ROTATE_UV_CHUNK: GlslChunk = {
    name: 'sgRotate',
    source: `vec2 sgRotate(vec2 uv, vec2 center, float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  vec2 offset = uv - center;
  return vec2(offset.x * cosine - offset.y * sine, offset.x * sine + offset.y * cosine) + center;
}`,
};
export const POLAR_UV_CHUNK: GlslChunk = {
    name: 'sgPolar',
    source: `vec2 sgPolar(vec2 uv, vec2 center) {
  vec2 offset = uv - center;
  return vec2(length(offset) * 2.0, atan(offset.y, offset.x) / 6.2831853 + 0.5);
}`,
};
