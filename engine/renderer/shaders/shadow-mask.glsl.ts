import { SHADOW_SAMPLING_CHUNK } from './chunks/shadow-sampling.glsl';
import { CLOUD_SHADOW_CHUNK } from './chunks/cloud-shadow-sampling.glsl';
import { SCREEN_OCCLUSION_CHUNK } from './chunks/screen-occlusion.glsl';
import { SHADOW_MASK_ENCODING_CHUNK } from './chunks/shadow-mask-encoding.glsl';
export const SHADOW_MASK_FRAGMENT_SHADER = `#version 300 es
precision highp float;

#ifndef SHADOW_MASK_BLOCK
#define SHADOW_MASK_BLOCK 1
#endif
#define SHADOW_SKY_OCCLUSION

uniform vec3 u_cameraPosition;
uniform vec3 u_lightDirection;

${SCREEN_OCCLUSION_CHUNK}
${SHADOW_SAMPLING_CHUNK}
${CLOUD_SHADOW_CHUNK}
${SHADOW_MASK_ENCODING_CHUNK}

out highp uvec4 fragColor;

void main() {
  ivec2 size = textureSize(u_depth, 0) - 1;
  ivec2 base = ivec2(gl_FragCoord.xy) * SHADOW_MASK_BLOCK;
  ivec2 px = min(base, size);
  float depth = texelFetch(u_depth, px, 0).r;
#if SHADOW_MASK_BLOCK > 1
                                                                                                          
  for (int y = 0; y < SHADOW_MASK_BLOCK; y++) {
    for (int x = 0; x < SHADOW_MASK_BLOCK; x++) {
      ivec2 candidate = min(base + ivec2(x, y), size);
      float candidateDepth = texelFetch(u_depth, candidate, 0).r;
      if (candidateDepth < depth) {
        depth = candidateDepth;
        px = candidate;
      }
    }
  }
#endif
  if (depth >= 1.0) {
                                                                                                                       
    fragColor = encodeShadowMask(vec4(1.0, 1.0, 1.0, 0.0));
    return;
  }
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
  float viewDistance = distance(P, u_cameraPosition);
  float visibility = 1.0;
                                                                                     
  float skyOcclusion = screenOcclusion(px, size, P, N, viewDistance);
  if (u_shadowEnabled > 0.5) {
                                                                                                           
    float block = float(SHADOW_MASK_BLOCK);
    ShadowSample shadow = sampleDirectionalShadowSample(P, N, L, dot(N, L), ddx * block, ddy * block);
    visibility = shadow.visibility;
                                                                                                                              
    skyOcclusion = max(skyOcclusion, shadow.skyOcclusion);
  }
  fragColor = encodeShadowMask(vec4(visibility, cloudShadow(P, L), packShadowMaskDistance(viewDistance), skyOcclusion));
}
`;
