import type { GlslChunk } from '../node-definition';
import { LUMINANCE_CHUNK } from './color-chunks';
export const CHROMATIC_ABERRATION_CHUNK: GlslChunk = {
    name: 'sgChromaticAberration',
    source: `vec3 sgChromaticAberration(vec2 uv, float strength) {
  vec2 shift = (uv - 0.5) * strength;
  return vec3(texture(uSceneColor, uv + shift).r, texture(uSceneColor, uv).g, texture(uSceneColor, uv - shift).b);
}`,
};
export const BLUR_CHUNK: GlslChunk = {
    name: 'sgBlur',
    source: `vec3 sgBlur(vec2 uv, float radius) {
  vec2 texel = radius / uResolution;
  vec3 total = texture(uSceneColor, uv).rgb * 0.25;
  total += texture(uSceneColor, uv + texel * vec2(1.0, 0.0)).rgb * 0.125;
  total += texture(uSceneColor, uv - texel * vec2(1.0, 0.0)).rgb * 0.125;
  total += texture(uSceneColor, uv + texel * vec2(0.0, 1.0)).rgb * 0.125;
  total += texture(uSceneColor, uv - texel * vec2(0.0, 1.0)).rgb * 0.125;
  total += texture(uSceneColor, uv + texel).rgb * 0.0625;
  total += texture(uSceneColor, uv - texel).rgb * 0.0625;
  total += texture(uSceneColor, uv + texel * vec2(1.0, -1.0)).rgb * 0.0625;
  total += texture(uSceneColor, uv + texel * vec2(-1.0, 1.0)).rgb * 0.0625;
  return total;
}`,
};
export const EDGE_CHUNK: GlslChunk = {
    name: 'sgEdge',
    requires: [LUMINANCE_CHUNK],
    source: `float sgEdge(vec2 uv, float thickness) {
  vec2 texel = thickness / uResolution;
  float left = sgLuminance(texture(uSceneColor, uv - vec2(texel.x, 0.0)).rgb);
  float right = sgLuminance(texture(uSceneColor, uv + vec2(texel.x, 0.0)).rgb);
  float below = sgLuminance(texture(uSceneColor, uv - vec2(0.0, texel.y)).rgb);
  float above = sgLuminance(texture(uSceneColor, uv + vec2(0.0, texel.y)).rgb);
  return clamp(length(vec2(right - left, above - below)) * 4.0, 0.0, 1.0);
}`,
};
