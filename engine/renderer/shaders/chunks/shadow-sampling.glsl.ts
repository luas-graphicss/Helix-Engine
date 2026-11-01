import { MAX_SHADOW_CASCADES } from '@/engine/renderer/shadows/shadow-cascades';
export const SHADOW_SAMPLING_CHUNK = `
uniform highp sampler2DArrayShadow u_shadowMap;
                                                                                                           
uniform float u_shadowEnabled;
uniform mat4 u_shadowMatrix[${MAX_SHADOW_CASCADES}];
uniform float u_shadowTexelWorld[${MAX_SHADOW_CASCADES}];
                                                                                                                     
uniform highp int u_shadowCascadeCount;
uniform float u_shadowMapSize;

const int MAX_SHADOW_CASCADES = ${MAX_SHADOW_CASCADES};
const float SHADOW_NORMAL_OFFSET_TEXELS = 1.0;
const float SHADOW_DEPTH_BIAS_TEXELS = 0.75;
const float SHADOW_MAX_PLANE_BIAS = 8.0;
                                                                                                  
const float CASCADE_FADE_START = 0.8;
                                                                             
const float CASCADE_BORDER_TEXELS = 3.0;
                                                                                                           
const float TENT_HALF_WIDTH = 2.5;
                                                                                                                    
const int MAX_FOOTPRINT_PROBES = 6;
const float MAX_FOOTPRINT_TEXELS = float(MAX_FOOTPRINT_PROBES) * TENT_HALF_WIDTH;
                                                                                       
const float FOOTPRINT_FADE_START = 0.7;
   
                                                                               
                                                                              
                                                                           
   
const float PENUMBRA_MIN_PIXELS = 1.25;
   
                                                                           
                                                                              
                           
   
const float PENUMBRA_MIN_TEXELS = 1.0;
   
                                                                              
                                                                             
                                                                               
                                    
   
const float PROBE_RAMP_FACTOR = 0.4;

   
                                                                             
                                                                                
                                                                              
                                                                   
   
struct ShadowFootprint {
  vec2 planeBias;
                                                                                                             
  vec2 majorAxis;
  float majorTexels;
                                               
  float minorTexels;
};

vec2 receiverPlaneDepthBias(vec3 dx, vec3 dy) {
  float det = dx.x * dy.y - dx.y * dy.x;
  if (abs(det) < 1e-12) return vec2(0.0);
  vec2 bias = vec2(dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z) / det;
  return clamp(bias, vec2(-SHADOW_MAX_PLANE_BIAS), vec2(SHADOW_MAX_PLANE_BIAS));
}

ShadowFootprint shadowFootprint(int cascade, vec3 positionDx, vec3 positionDy) {
  mat3 toTexture = mat3(u_shadowMatrix[cascade]);
  vec3 dx = toTexture * positionDx;
  vec3 dy = toTexture * positionDy;
  vec2 fx = dx.xy * u_shadowMapSize;
  vec2 fy = dy.xy * u_shadowMapSize;
  float lx = length(fx);
  float ly = length(fy);
  ShadowFootprint footprint;
  footprint.planeBias = receiverPlaneDepthBias(dx, dy);
  footprint.majorTexels = max(lx, ly);
  bool valid = footprint.majorTexels > 1e-6;
  footprint.majorAxis = valid ? (lx >= ly ? fx : fy) / footprint.majorTexels : vec2(1.0, 0.0);
                                                                                                   
  footprint.minorTexels = valid ? abs(fx.x * fy.y - fx.y * fy.x) / footprint.majorTexels : 0.0;
  return footprint;
}

   
                                                                       
                                                                             
                                                                                
                
   
float footprintDemand(ShadowFootprint footprint) {
  return max(footprint.majorTexels, footprint.minorTexels * float(MAX_FOOTPRINT_PROBES));
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

   
                                                                               
                                                                              
                                                                             
                                                                               
                                                                              
                                                                             
                                                                                
                                                     
   
float sharpenPenumbra(float visibility, ShadowFootprint footprint, float probeSpan) {
  float majorRamp = TENT_HALF_WIDTH + PROBE_RAMP_FACTOR * probeSpan;
  float rampPixels = min(majorRamp / max(footprint.majorTexels, 1e-4), TENT_HALF_WIDTH / max(footprint.minorTexels, 1e-4));
  float sharpness = clamp(rampPixels / PENUMBRA_MIN_PIXELS, 1.0, TENT_HALF_WIDTH / PENUMBRA_MIN_TEXELS);
  return clamp((visibility - 0.5) * sharpness + 0.5, 0.0, 1.0);
}

   
                                                                          
                                                                            
                                                                               
                                                                                
                                                                                 
                                                             
   
float cascadeVisibility(int cascade, vec3 coord, ShadowFootprint footprint) {
  float texel = 1.0 / u_shadowMapSize;
                                                                        
  coord.z -= min(2.0 * texel * (abs(footprint.planeBias.x) + abs(footprint.planeBias.y)), 0.01);
  float covered = min(footprint.majorTexels, MAX_FOOTPRINT_TEXELS);
  int probes = max(int(ceil(covered / TENT_HALF_WIDTH)), 1);
  if (probes == 1) return sharpenPenumbra(shadowPcfTent5x5(float(cascade), coord, footprint.planeBias), footprint, 0.0);

  vec2 stepUv = footprint.majorAxis * (covered / float(probes)) * texel;
  vec3 probeStep = vec3(stepUv, dot(stepUv, footprint.planeBias));
  vec3 probe = coord - probeStep * (0.5 * float(probes - 1));
  float sum = 0.0;
  for (int i = 0; i < MAX_FOOTPRINT_PROBES; i++) {
    if (i >= probes) break;
    sum += shadowPcfTent5x5(float(cascade), probe, footprint.planeBias);
    probe += probeStep;
  }
  return sharpenPenumbra(sum / float(probes), footprint, covered);
}

#ifdef SHADOW_SKY_OCCLUSION
 
uniform highp sampler2DArray u_shadowDepth;

                                                                                              
const float SKY_OCCLUSION_RING_RADIUS = 0.75;
                                                                            
const float SKY_OCCLUSION_RING_MIN_TEXELS = 1.5;
                                                                                                              
const float SKY_OCCLUSION_RING_MAX_TEXELS = 32.0;
                                                                                                                                  
const float SKY_OCCLUSION_SCALE = 1.25;
                                                                                         
const float SKY_OCCLUSION_CENTER_WEIGHT = 1.0 / 3.0;
 
const float SKY_OCCLUSION_FACING = 0.3;
                                                                                                                                    
const float SKY_OCCLUSION_BLOCKER_TEXELS = 2.0;

                                                                                                                    
float blockerWeight(float d) {
                                                                                                                       
  return SKY_OCCLUSION_SCALE / (max(d, 0.0) + SKY_OCCLUSION_SCALE);
}

 
float receiverPlaneDepth(mat3 toTexture, vec3 N, vec3 L, float NdotL, vec3 offset, float depth) {
  float t = -dot(N, offset) / max(NdotL, 0.2);
  return depth + (toTexture * (offset + L * t)).z;
}

float rawShadowDepth(int cascade, ivec2 texel) {
  int limit = int(u_shadowMapSize) - 1;
  return texelFetch(u_shadowDepth, ivec3(clamp(texel, ivec2(0), ivec2(limit)), cascade), 0).r;
}

                                                                                                        
float cascadeSkyOcclusion(int cascade, vec3 coord, vec3 N, vec3 L, float NdotL) {
  mat3 toTexture = mat3(u_shadowMatrix[cascade]);
  float texelWorld = u_shadowTexelWorld[cascade];
                                                                                                   
  vec3 right = normalize(vec3(toTexture[0][0], toTexture[1][0], toTexture[2][0]));
  vec3 up = normalize(vec3(toTexture[0][1], toTexture[1][1], toTexture[2][1]));
  float metersPerDepth = 1.0 / max(-(toTexture * L).z, 1e-6);
  float blockerMin = SKY_OCCLUSION_BLOCKER_TEXELS * texelWorld;

                                                                                                             
                                                                                                       
  vec2 st = coord.xy * u_shadowMapSize - 0.5;
  vec2 base = floor(st);
  vec2 f = st - base;
  float centerOcclusion = 0.0;
  float coverage = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 corner = vec2(k & 1, k >> 1);
    float weight = (corner.x > 0.5 ? f.x : 1.0 - f.x) * (corner.y > 0.5 ? f.y : 1.0 - f.y);
    vec3 offset = (right * (corner.x - f.x) + up * (corner.y - f.y)) * texelWorld;
    float planeDepth = receiverPlaneDepth(toTexture, N, L, NdotL, offset, coord.z);
    float d = (planeDepth - rawShadowDepth(cascade, ivec2(base) + ivec2(corner))) * metersPerDepth;
    float blocker = weight * smoothstep(0.0, blockerMin, d);
    coverage += blocker;
    centerOcclusion += blocker * blockerWeight(d);
  }

                                                                                                              
                                                                                                                 
                                                                                  
  float ringMeters = clamp(SKY_OCCLUSION_RING_RADIUS / texelWorld, SKY_OCCLUSION_RING_MIN_TEXELS, SKY_OCCLUSION_RING_MAX_TEXELS) * texelWorld;
  float ringMeters2 = ringMeters * ringMeters;
  float ringOcclusion = 0.0;
  for (int k = 0; k < 4; k++) {
    vec3 axis = k < 2 ? right : up;
    vec3 offset = axis * ((k & 1) == 0 ? ringMeters : -ringMeters);
    vec2 tapUv = coord.xy + (toTexture * offset).xy;
    float planeDepth = receiverPlaneDepth(toTexture, N, L, NdotL, offset, coord.z);
    float d = (planeDepth - rawShadowDepth(cascade, ivec2(floor(tapUv * u_shadowMapSize)))) * metersPerDepth;
    float horizon = d * d / (d * d + ringMeters2);
    ringOcclusion += smoothstep(0.0, blockerMin, d) * blockerWeight(d) * mix(horizon, 1.0, coverage);
  }
  ringOcclusion *= 0.25;
  return SKY_OCCLUSION_CENTER_WEIGHT * centerOcclusion + (1.0 - SKY_OCCLUSION_CENTER_WEIGHT) * ringOcclusion;
}
#endif

                                                                                                                 
struct ShadowSample {
                                                                              
  float visibility;
                                                                                                                    
  float skyOcclusion;
};

   
                                                                                 
                                                                            
                                                                              
                                                        
   
ShadowSample sampleDirectionalShadowSample(vec3 worldPos, vec3 N, vec3 L, float NdotL, vec3 positionDx, vec3 positionDy) {
  ShadowSample result;
  result.visibility = 1.0;
  result.skyOcclusion = 0.0;
  float sinTheta = sqrt(max(1.0 - NdotL * NdotL, 0.0));
#ifdef SHADOW_SKY_OCCLUSION
  float facing = smoothstep(0.0, SKY_OCCLUSION_FACING, NdotL);
#endif
  for (int i = 0; i < MAX_SHADOW_CASCADES; i++) {
    if (i >= u_shadowCascadeCount) break;
    bool last = i + 1 >= u_shadowCascadeCount;
    ShadowFootprint footprint = shadowFootprint(i, positionDx, positionDy);
    float demand = footprintDemand(footprint);
                                                                                      
    if (!last && demand >= MAX_FOOTPRINT_TEXELS) continue;

    vec3 coord = cascadeCoord(i, worldPos, N, L, sinTheta);
                                                                                                  
    float margin = CASCADE_BORDER_TEXELS + 0.5 * min(footprint.majorTexels, MAX_FOOTPRINT_TEXELS);
    float usable = 1.0 - 2.0 * margin / u_shadowMapSize;
    vec2 fromCenter = abs(coord.xy - 0.5) * 2.0;
    float extent = max(fromCenter.x, fromCenter.y);
    if (extent > usable) {
      if (last) return result;
      continue;
    }

    float visibility = cascadeVisibility(i, coord, footprint);
    float occlusion = 0.0;
#ifdef SHADOW_SKY_OCCLUSION
    if (facing > 0.0) occlusion = cascadeSkyOcclusion(i, coord, N, L, NdotL);
#endif
    float borderFade = smoothstep(CASCADE_FADE_START, usable, extent);
    float footprintFade = smoothstep(FOOTPRINT_FADE_START * MAX_FOOTPRINT_TEXELS, MAX_FOOTPRINT_TEXELS, demand);
    float fade = max(borderFade, footprintFade);
    if (fade > 0.0 && !last) {
      vec3 nextCoord = cascadeCoord(i + 1, worldPos, N, L, sinTheta);
      ShadowFootprint nextFootprint = shadowFootprint(i + 1, positionDx, positionDy);
      visibility = mix(visibility, cascadeVisibility(i + 1, nextCoord, nextFootprint), fade);
#ifdef SHADOW_SKY_OCCLUSION
      if (facing > 0.0) occlusion = mix(occlusion, cascadeSkyOcclusion(i + 1, nextCoord, N, L, NdotL), fade);
#endif
    }
    result.visibility = visibility;
#ifdef SHADOW_SKY_OCCLUSION
    result.skyOcclusion = occlusion * facing;
#endif
    return result;
  }
  return result;
}

                                                                                                               
float sampleDirectionalShadow(vec3 worldPos, vec3 N, vec3 L, float NdotL, vec3 positionDx, vec3 positionDy) {
  return sampleDirectionalShadowSample(worldPos, N, L, NdotL, positionDx, positionDy).visibility;
}
`;
