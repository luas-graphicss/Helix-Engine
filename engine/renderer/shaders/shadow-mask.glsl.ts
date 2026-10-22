import { SHADOW_SAMPLING_CHUNK } from './chunks/shadow-sampling.glsl';
import { CLOUD_SHADOW_CHUNK } from './chunks/cloud-shadow-sampling.glsl';
export const SHADOW_MASK_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform highp sampler2D u_depth;
uniform mat4 u_inverseViewProjection;
uniform vec3 u_cameraPosition;
uniform vec3 u_lightDirection;
uniform float u_shadowEnabled;

${SHADOW_SAMPLING_CHUNK}
${CLOUD_SHADOW_CHUNK}

out vec4 fragColor;

vec3 worldFromDepth(ivec2 px, float depth) {
  vec2 uv = (vec2(px) + 0.5) / vec2(textureSize(u_depth, 0));
  vec4 world = u_inverseViewProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return world.xyz / world.w;
}

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  float depth = texelFetch(u_depth, px, 0).r;
  if (depth >= 1.0) {
    fragColor = vec4(1.0);
    return;
  }
  ivec2 size = textureSize(u_depth, 0) - 1;
  float dL = texelFetch(u_depth, max(px - ivec2(1, 0), ivec2(0)), 0).r;
  float dR = texelFetch(u_depth, min(px + ivec2(1, 0), size), 0).r;
  float dD = texelFetch(u_depth, max(px - ivec2(0, 1), ivec2(0)), 0).r;
  float dU = texelFetch(u_depth, min(px + ivec2(0, 1), size), 0).r;

  vec3 P = worldFromDepth(px, depth);

  vec3 ddx = abs(dL - depth) < abs(dR - depth) ? P - worldFromDepth(px - ivec2(1, 0), dL) : worldFromDepth(px + ivec2(1, 0), dR) - P;
  vec3 ddy = abs(dD - depth) < abs(dU - depth) ? P - worldFromDepth(px - ivec2(0, 1), dD) : worldFromDepth(px + ivec2(0, 1), dU) - P;
  vec3 N = cross(ddx, ddy);
  float length2 = dot(N, N);
  N = length2 > 1e-20 ? N * inversesqrt(length2) : u_lightDirection;
  if (dot(N, u_cameraPosition - P) < 0.0) N = -N;

  vec3 L = u_lightDirection;
  float visibility = 1.0;
  if (u_shadowEnabled > 0.5) {
    visibility = sampleDirectionalShadow(P, N, L, dot(N, L), ddx, ddy);
  }
  fragColor = vec4(visibility, cloudShadow(P, L), 0.0, 1.0);
}
`;
