import { HDR_RANGE_SCENE } from '@/engine/renderer/shaders/chunks/hdr-encoding.glsl';
export const PLANAR_REFLECTION_CHUNK = `
uniform sampler2D u_mirrorColor;
uniform vec4 u_mirrorPlane;
uniform float u_mirrorEnabled;

const float MIRROR_ALIGNMENT = 0.999;
const float MIRROR_REACH = 0.02;
const float MIRROR_REACH_GROWTH = 0.002;

bool liesOnMirror(vec3 viewPosition, vec3 viewNormal) {
  if (u_mirrorEnabled < 0.5) return false;
  float gap = abs(dot(u_mirrorPlane.xyz, viewPosition) + u_mirrorPlane.w);
  return gap < MIRROR_REACH - MIRROR_REACH_GROWTH * viewPosition.z && dot(viewNormal, u_mirrorPlane.xyz) > MIRROR_ALIGNMENT;
}

vec3 mirrorRadiance(vec2 uv) {
  return decodeHdr(texture(u_mirrorColor, vec2(1.0 - uv.x, uv.y)), ${HDR_RANGE_SCENE}.0).rgb;
}
`;
