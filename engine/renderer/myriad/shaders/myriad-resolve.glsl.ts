import { DEBUG_VIEW_CHUNK } from '@/engine/renderer/shaders/chunks/debug-view.glsl';
import { SCENE_LIGHTING_CHUNK } from '@/engine/renderer/shaders/chunks/scene-lighting.glsl';
import { MYRIAD_INSTANCE_CHUNK, MYRIAD_POOL_CHUNK } from './myriad-pool.glsl';
export const MYRIAD_RESOLVE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform highp usampler2D u_visBuffer;
uniform highp usampler2D u_list;
uniform highp sampler2D u_instances;
uniform mat4 u_viewProjection;
uniform uint u_stateId;
uniform vec2 u_screenSize;
                                                                                                                                              
uniform int u_debugView;
uniform int u_wireframe;

uniform sampler2D u_baseColorMap;
uniform sampler2D u_metallicRoughnessMap;
uniform sampler2D u_normalMap;
uniform sampler2D u_occlusionMap;
uniform sampler2D u_emissiveMap;
                                                                                                        
uniform int u_textureMask;

${MYRIAD_POOL_CHUNK}
${MYRIAD_INSTANCE_CHUNK}
${SCENE_LIGHTING_CHUNK}
${DEBUG_VIEW_CHUNK}

const int MAP_BASE_COLOR = 1;
const int MAP_METALLIC_ROUGHNESS = 2;
const int MAP_NORMAL = 4;
const int MAP_OCCLUSION = 8;
const int MAP_EMISSIVE = 16;
const uint STATE_MASK = 0xffffu;
const uint POST_PASS_BIT = 0x10000u;
const uint SLOT_MASK = 0x1ffffffu;
const uint TRIANGLE_SHIFT = 25u;

bool hasMap(int bit) {
  return (u_textureMask & bit) != 0;
}

struct Barycentrics {
  vec3 lambda;
  vec3 ddx;
  vec3 ddy;
};

   
                                                                        
                                                                             
                                                                         
   
const float BARYCENTRIC_SLACK = 0.02;
   
                                                                            
                                                                              
                                                                                  
   
const float MIN_RELATIVE_DETERMINANT = 1e-12;

   
                                                                             
                                                                      
  
                                                                                      
                                                                                   
                                                                                 
                                                                        
                                                                                 
                                                                            
                                                                                
                                                                           
                                                                               
                                           
   
Barycentrics computeBarycentrics(vec4 c0, vec4 c1, vec4 c2, vec2 pixelNdc) {
  Barycentrics b;
  mat3 m = mat3(c0.xyw, c1.xyw, c2.xyw);
  float det = determinant(m);
  float scale = length(c0.xyw) * length(c1.xyw) * length(c2.xyw);
  bool stable = abs(det) > scale * MIN_RELATIVE_DETERMINANT;
                                                                                                                   
  mat3 inv = stable ? inverse(m) : mat3(1.0);
  vec3 a = inv * vec3(pixelNdc, 1.0);
  float sum = a.x + a.y + a.z;
                                                                                              
  if (!(sum > 0.0)) stable = false;
  b.lambda = a / (stable ? sum : 1.0);
  if (any(lessThan(b.lambda, vec3(-BARYCENTRIC_SLACK))) || any(greaterThan(b.lambda, vec3(1.0 + BARYCENTRIC_SLACK)))) stable = false;

  if (!stable) {
                                                                                                                    
    vec3 clamped = clamp(b.lambda, 0.0, 1.0);
    float total = clamped.x + clamped.y + clamped.z;
    b.lambda = total > 1e-6 && total < 3.0 ? clamped / total : vec3(1.0 / 3.0);
                                                                                            
    b.ddx = vec3(-1.0, 1.0, 0.0);
    b.ddy = vec3(-1.0, 0.0, 1.0);
    return b;
  }

                                                                                                                                              
  vec2 ndcPerPixel = 2.0 / u_screenSize;
  vec3 ax = inv[0] * ndcPerPixel.x;
  vec3 ay = inv[1] * ndcPerPixel.y;
  b.ddx = (ax - b.lambda * (ax.x + ax.y + ax.z)) / sum;
  b.ddy = (ay - b.lambda * (ay.x + ay.y + ay.z)) / sum;
  return b;
}

vec3 interpolate(vec3 l, vec3 a, vec3 b, vec3 c) {
  return l.x * a + l.y * b + l.z * c;
}

vec2 interpolate(vec3 l, vec2 a, vec2 b, vec2 c) {
  return l.x * a + l.y * b + l.z * c;
}

   
                                                                               
                                                                              
   
vec3 perturbNormal(vec3 N, vec3 dp1, vec3 dp2, vec2 duv1, vec2 duv2, vec2 uv, float normalScale) {
  vec3 mapN = textureGrad(u_normalMap, uv, duv1, duv2).xyz * 2.0 - 1.0;
  mapN.xy *= vec2(normalScale, -normalScale);
  vec3 dp2perp = cross(dp2, N);
  vec3 dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float det = max(dot(T, T), dot(B, B));
  if (det <= 0.0) return N;
  float scale = inversesqrt(det);
  return normalize(T * (mapN.x * scale) + B * (mapN.y * scale) + N * mapN.z);
}

out vec4 fragColor;

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  uvec2 vis = texelFetch(u_visBuffer, px, 0).xy;
  if (vis.x == 0u || (vis.y & STATE_MASK) != u_stateId) discard;

  uint slot = (vis.x & SLOT_MASK) - 1u;
  uint triangle = vis.x >> TRIANGLE_SHIFT;
  uvec4 entry = texelFetch(u_list, texelCoord(slot), 0);
  uint cluster = entry.x;
  int instance = int(entry.y);

  mat4 world = instanceMatrix(instance, 0);
  mat3 normalMatrix = mat3(instanceTexel(instance, 8).xyz, instanceTexel(instance, 9).xyz, instanceTexel(instance, 10).xyz);
  vec4 baseColorOpacity = instanceTexel(instance, 11);
  vec4 surface = instanceTexel(instance, 12);
  vec4 emissiveCutoff = instanceTexel(instance, 13);
  vec4 mapParams = instanceTexel(instance, 14);

  uvec4 info = loadClusterInfo(cluster);
  ClusterBox box = loadClusterBox(cluster);
  uvec3 tri = loadTriangle(cluster, triangle);
  PoolVertex v0 = loadVertex(info.x + tri.x, box);
  PoolVertex v1 = loadVertex(info.x + tri.y, box);
  PoolVertex v2 = loadVertex(info.x + tri.z, box);
  vec3 w0 = (world * vec4(v0.position, 1.0)).xyz;
  vec3 w1 = (world * vec4(v1.position, 1.0)).xyz;
  vec3 w2 = (world * vec4(v2.position, 1.0)).xyz;

  vec2 pixelNdc = (gl_FragCoord.xy / u_screenSize) * 2.0 - 1.0;
  Barycentrics b = computeBarycentrics(u_viewProjection * vec4(w0, 1.0), u_viewProjection * vec4(w1, 1.0), u_viewProjection * vec4(w2, 1.0), pixelNdc);

  vec3 worldPosition = interpolate(b.lambda, w0, w1, w2);
  vec3 positionDx = interpolate(b.ddx, w0, w1, w2);
  vec3 positionDy = interpolate(b.ddy, w0, w1, w2);
  float uvTiling = instanceTexel(instance, 15).x;
  vec2 uv = interpolate(b.lambda, v0.uv, v1.uv, v2.uv) * uvTiling;
  vec2 uvDx = interpolate(b.ddx, v0.uv, v1.uv, v2.uv) * uvTiling;
  vec2 uvDy = interpolate(b.ddy, v0.uv, v1.uv, v2.uv) * uvTiling;

  vec3 N = normalize(normalMatrix * interpolate(b.lambda, v0.normal, v1.normal, v2.normal));
  vec3 faceNormal = cross(w1 - w0, w2 - w0);
  if (dot(faceNormal, u_cameraPosition - worldPosition) < 0.0) N = -N;

  vec3 color;
  if (u_debugView == DEBUG_VIEW_NONE) {
    vec3 baseColor = baseColorOpacity.rgb;
    if (hasMap(MAP_BASE_COLOR)) baseColor *= textureGrad(u_baseColorMap, uv, uvDx, uvDy).rgb;

    float roughness = surface.x;
    float metallic = surface.y;
    if (hasMap(MAP_METALLIC_ROUGHNESS)) {
      vec4 metallicRoughness = textureGrad(u_metallicRoughnessMap, uv, uvDx, uvDy);
      roughness *= metallicRoughness.g;
      metallic *= metallicRoughness.b;
    }
    if (hasMap(MAP_NORMAL)) N = perturbNormal(N, positionDx, positionDy, uvDx, uvDy, uv, mapParams.x);

    float occlusion = 1.0;
    if (hasMap(MAP_OCCLUSION)) occlusion = 1.0 + mapParams.y * (textureGrad(u_occlusionMap, uv, uvDx, uvDy).r - 1.0);

    vec3 emissive = emissiveCutoff.rgb * surface.z;
    if (hasMap(MAP_EMISSIVE)) emissive *= textureGrad(u_emissiveMap, uv, uvDx, uvDy).rgb;

    Surface s = makeSurface(N, worldPosition, baseColor, roughness, metallic);
    vec3 hdr = shadeSurface(s, worldPosition, positionDx, positionDy, occlusion, emissive, surface.w);
    color = exposeSurfaceColor(hdr, s, mapParams.z);
  } else if (u_debugView == DEBUG_VIEW_NORMALS) {
    color = displayColorToSceneHdr(normalDebugColor(N));
  } else {
    if (u_debugView == DEBUG_VIEW_CLUSTERS) color = hashColor(cluster + 1u);
    else if (u_debugView == DEBUG_VIEW_GROUPS) color = hashColor(info.z >> 8u);
                                                                                                           
    else if (u_debugView == DEBUG_VIEW_LEVELS) color = LEVEL_PALETTE[min(int(info.z & 0xffu), 7)];
    else if (u_debugView == DEBUG_VIEW_TRIANGLES) color = hashColor(cluster * 131u + triangle + 7u);
    else color = (vis.y & POST_PASS_BIT) != 0u ? vec3(0.95, 0.55, 0.15) : vec3(0.25, 0.75, 0.35);
    color = shadeDebugColor(color, N, u_sunDirection);
                                                                                                             
    color = displayColorToSceneHdr(color);
    color = mix(color, SELECTION_TINT_HDR, mapParams.z * 0.35);
  }

  if (u_wireframe == 1 || u_debugView == DEBUG_VIEW_TRIANGLES) {
    vec3 spread = abs(b.ddx) + abs(b.ddy);
    vec3 edgeDistance = b.lambda / max(spread, vec3(1e-7));
    float nearestEdge = min(edgeDistance.x, min(edgeDistance.y, edgeDistance.z));
    float wire = 1.0 - smoothstep(0.5, 1.5, nearestEdge);
    color = mix(color, vec3(0.002), wire * 0.85);
  }

  fragColor = sceneColorOutput(color, 1.0);
}
`;
