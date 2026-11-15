import { HDR_ENCODING_CHUNK, HDR_RANGE_SCENE } from '@/engine/renderer/shaders/chunks/hdr-encoding.glsl';
import { CUBE_DIRECTION_CHUNK } from './cube-direction.glsl';
export const PROBE_CROSSFADE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform samplerCube u_outgoing;
uniform samplerCube u_incoming;
uniform int u_face;
uniform float u_level;
uniform float u_targetSize;
uniform float u_weight;

${HDR_ENCODING_CHUNK}
${CUBE_DIRECTION_CHUNK}

out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy / u_targetSize) * 2.0 - 1.0;
  vec3 direction = cubeDirection(u_face, uv);
  vec3 outgoing = decodeHdr(textureLod(u_outgoing, direction, u_level), ${HDR_RANGE_SCENE}.0).rgb;
  vec3 incoming = decodeHdr(textureLod(u_incoming, direction, u_level), ${HDR_RANGE_SCENE}.0).rgb;
  fragColor = encodeHdr(mix(outgoing, incoming, u_weight), 1.0, ${HDR_RANGE_SCENE}.0);
}
`;
