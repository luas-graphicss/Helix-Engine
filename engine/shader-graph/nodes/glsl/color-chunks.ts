import type { GlslChunk } from '../node-definition';
export const LUMINANCE_CHUNK: GlslChunk = {
    name: 'sgLuminance',
    source: `float sgLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}`,
};
export const HUE_SHIFT_CHUNK: GlslChunk = {
    name: 'sgHueShift',
    source: `vec3 sgHueShift(vec3 color, float shift) {
  vec3 axis = vec3(0.57735);
  float angle = shift * 6.2831853;
  float cosine = cos(angle);
  return color * cosine + cross(axis, color) * sin(angle) + axis * dot(axis, color) * (1.0 - cosine);
}`,
};
export const COLOR_ADJUST_CHUNK: GlslChunk = {
    name: 'sgColorAdjust',
    requires: [LUMINANCE_CHUNK],
    source: `vec3 sgColorAdjust(vec3 color, float saturation, float contrast, float brightness) {
  vec3 adjusted = mix(vec3(sgLuminance(color)), color, saturation);
  adjusted = (adjusted - 0.5) * contrast + 0.5 + brightness;
  return max(adjusted, vec3(0.0));
}`,
};
