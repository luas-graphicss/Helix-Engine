import { MAX_SHADOW_CASCADES } from '@/engine/renderer/shadows/shadow-cascades';
export const SHADOW_SAMPLING_CHUNK = `
uniform highp sampler2DArrayShadow u_shadowMap;
uniform mat4 u_shadowMatrix[${MAX_SHADOW_CASCADES}];
uniform float u_shadowTexelWorld[${MAX_SHADOW_CASCADES}];
uniform int u_shadowCascadeCount;
uniform float u_shadowMapSize;

const int MAX_SHADOW_CASCADES = ${MAX_SHADOW_CASCADES};
const float SHADOW_NORMAL_OFFSET_TEXELS = 1.0;
const float SHADOW_DEPTH_BIAS_TEXELS = 0.75;
const float SHADOW_MAX_PLANE_BIAS = 8.0;
 
const float CASCADE_FADE_START = 0.8;
 
const float CASCADE_BORDER_TEXELS = 3.0;





vec2 receiverPlaneDepthBias(vec3 dx, vec3 dy) {
  float det = dx.x * dy.y - dx.y * dy.x;
  if (abs(det) < 1e-12) return vec2(0.0);
  vec2 bias = vec2(dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z) / det;
  return clamp(bias, vec2(-SHADOW_MAX_PLANE_BIAS), vec2(SHADOW_MAX_PLANE_BIAS));
}

float shadowTap(float layer, vec2 baseUv, float u, float v, float texel, float depth, vec2 planeBias) {
  vec2 offset = vec2(u, v) * texel;
  float z = clamp(depth + dot(offset, planeBias), 0.0, 1.0);
  return texture(u_shadowMap, vec4(baseUv + offset, layer, z));
}





float shadowPcfTent5x5(float layer, vec3 coord, vec2 planeBias) {
  float texel = 1.0 / u_shadowMapSize;
  vec2 uv = coord.xy * u_shadowMapSize;
  vec2 baseUv = floor(uv + 0.5);
  float s = uv.x + 0.5 - baseUv.x;
  float t = uv.y + 0.5 - baseUv.y;
  baseUv = (baseUv - 0.5) * texel;

  float uw0 = 4.0 - 3.0 * s;
  float uw1 = 7.0;
  float uw2 = 1.0 + 3.0 * s;
  float u0 = (3.0 - 2.0 * s) / uw0 - 2.0;
  float u1 = (3.0 + s) / uw1;
  float u2 = s / uw2 + 2.0;

  float vw0 = 4.0 - 3.0 * t;
  float vw1 = 7.0;
  float vw2 = 1.0 + 3.0 * t;
  float v0 = (3.0 - 2.0 * t) / vw0 - 2.0;
  float v1 = (3.0 + t) / vw1;
  float v2 = t / vw2 + 2.0;

  float depth = coord.z;
  float sum = 0.0;
  sum += uw0 * vw0 * shadowTap(layer, baseUv, u0, v0, texel, depth, planeBias);
  sum += uw1 * vw0 * shadowTap(layer, baseUv, u1, v0, texel, depth, planeBias);
  sum += uw2 * vw0 * shadowTap(layer, baseUv, u2, v0, texel, depth, planeBias);
  sum += uw0 * vw1 * shadowTap(layer, baseUv, u0, v1, texel, depth, planeBias);
  sum += uw1 * vw1 * shadowTap(layer, baseUv, u1, v1, texel, depth, planeBias);
  sum += uw2 * vw1 * shadowTap(layer, baseUv, u2, v1, texel, depth, planeBias);
  sum += uw0 * vw2 * shadowTap(layer, baseUv, u0, v2, texel, depth, planeBias);
  sum += uw1 * vw2 * shadowTap(layer, baseUv, u1, v2, texel, depth, planeBias);
  sum += uw2 * vw2 * shadowTap(layer, baseUv, u2, v2, texel, depth, planeBias);
  return sum / 144.0;
}

 
vec3 cascadeCoord(int cascade, vec3 worldPos, vec3 N, vec3 L, float sinTheta) {
  float texelWorld = u_shadowTexelWorld[cascade];
  vec3 offsetPos = worldPos
    + N * (texelWorld * SHADOW_NORMAL_OFFSET_TEXELS * sinTheta)
    + L * (texelWorld * SHADOW_DEPTH_BIAS_TEXELS);
  return (u_shadowMatrix[cascade] * vec4(offsetPos, 1.0)).xyz;
}






float cascadeVisibility(int cascade, vec3 coord, vec3 positionDx, vec3 positionDy) {
  mat3 toTexture = mat3(u_shadowMatrix[cascade]);
  vec2 planeBias = receiverPlaneDepthBias(toTexture * positionDx, toTexture * positionDy);
   
  float texel = 1.0 / u_shadowMapSize;
  coord.z -= min(2.0 * texel * (abs(planeBias.x) + abs(planeBias.y)), 0.01);
  return shadowPcfTent5x5(float(cascade), coord, planeBias);
}






float sampleDirectionalShadow(vec3 worldPos, vec3 N, vec3 L, float NdotL, vec3 positionDx, vec3 positionDy) {
  float sinTheta = sqrt(max(1.0 - NdotL * NdotL, 0.0));
  float usable = 1.0 - CASCADE_BORDER_TEXELS * 2.0 / u_shadowMapSize;
  for (int i = 0; i < MAX_SHADOW_CASCADES; i++) {
    if (i >= u_shadowCascadeCount) break;
    vec3 coord = cascadeCoord(i, worldPos, N, L, sinTheta);
    vec2 fromCenter = abs(coord.xy - 0.5) * 2.0;
    float extent = max(fromCenter.x, fromCenter.y);
    if (extent > usable) continue;

    float visibility = cascadeVisibility(i, coord, positionDx, positionDy);
    float fade = smoothstep(CASCADE_FADE_START, usable, extent);
    if (fade > 0.0 && i + 1 < u_shadowCascadeCount) {
      vec3 nextCoord = cascadeCoord(i + 1, worldPos, N, L, sinTheta);
      visibility = mix(visibility, cascadeVisibility(i + 1, nextCoord, positionDx, positionDy), fade);
    }
    return visibility;
  }
  return 1.0;
}
`;
