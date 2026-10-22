import { SCENE_LIGHTING_CHUNK } from './chunks/scene-lighting.glsl';
import { TERRAIN_MATERIAL_CHUNK } from './chunks/terrain-material.glsl';
import { TERRAIN_VERTEX_CHUNK } from './chunks/terrain-vertex.glsl';
import { OCTAHEDRAL_CHUNK } from './chunks/octahedral.glsl';
import { MAX_TERRAIN_CACHE_LEVELS } from '@/engine/renderer/terrain/terrain-cache-layout';
export const TERRAIN_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

invariant gl_Position;

${TERRAIN_VERTEX_CHUNK}

uniform mat4 u_viewProjection;
uniform mat4 u_model;

out vec3 v_worldPosition;
out vec3 v_localPosition;
out vec3 v_localNormal;
out vec2 v_uv;

void main() {
  ivec2 grid = terrainGrid();
  float height = terrainHeight(grid);
  float left = terrainHeight(grid + ivec2(-1, 0));
  float right = terrainHeight(grid + ivec2(1, 0));
  float up = terrainHeight(grid + ivec2(0, -1));
  float down = terrainHeight(grid + ivec2(0, 1));

  vec3 local = terrainLocalPosition(grid, height);
  vec4 worldPosition = u_model * vec4(local, 1.0);
  v_worldPosition = worldPosition.xyz;
  v_localPosition = local;
  v_localNormal = normalize(vec3(left - right, 2.0 * u_cellSize, up - down));
  v_uv = vec2(grid) / float(u_lastSample);
  gl_Position = u_viewProjection * worldPosition;
}
`;
export const TERRAIN_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2DArray;
precision highp isampler2DArray;

in vec3 v_worldPosition;
in vec3 v_localPosition;
in vec3 v_localNormal;
in vec2 v_uv;

${TERRAIN_MATERIAL_CHUNK}
${OCTAHEDRAL_CHUNK}


uniform sampler2DArray u_cacheAlbedo;
uniform sampler2DArray u_cacheNormal;

uniform highp isampler2DArray u_cachePages;

uniform vec4 u_cache;

uniform vec2 u_cacheCenter;

uniform vec4 u_cacheLevels[${MAX_TERRAIN_CACHE_LEVELS}];

uniform float u_cacheEnabled;

uniform vec2 u_distanceBlend;
uniform float u_halfSize;
uniform mat3 u_normalMatrix;

uniform vec4 u_brush;
uniform vec3 u_brushColor;
uniform float u_brushEnabled;
uniform float u_outline;
uniform float u_receiveShadows;

${SCENE_LIGHTING_CHUNK}


const float RING_BLEND_START = 0.7;

struct CacheSample {
  vec3 albedo;
  vec3 normal;
  float roughness;
  float occlusion;
  bool valid;
};


CacheSample sampleCacheLevel(int level, vec2 p) {
  vec4 info = u_cacheLevels[level];
  ivec2 tile = ivec2(floor(p / info.z));
  float tiles = u_cache.w;
  ivec2 slot = tile - int(tiles) * ivec2(floor(vec2(tile) / tiles));
  CacheSample s;
  s.albedo = vec3(0.0);
  s.normal = AXIS_Y;
  s.roughness = 1.0;
  s.occlusion = 1.0;
  s.valid = all(equal(texelFetch(u_cachePages, ivec3(slot, level), 0).rg, tile));
  if (s.valid) {
    vec3 uv = vec3(fract(p * info.y), float(level));
    vec4 a = textureLod(u_cacheAlbedo, uv, 0.0);
    vec4 b = textureLod(u_cacheNormal, uv, 0.0);
    s.albedo = a.rgb;
    s.roughness = a.a;
    s.normal = octDecode(b.rg * 2.0 - 1.0);
    s.occlusion = b.b;
  }
  return s;
}

vec3 applyBrush(vec3 color, vec2 xz, float ringWidth) {
  float d = distance(xz, u_brush.xy);
  float outer = 1.0 - smoothstep(0.0, ringWidth, abs(d - u_brush.z));
  float inner = (1.0 - smoothstep(0.0, ringWidth * 0.7, abs(d - u_brush.w))) * 0.55;
  float fill = (1.0 - smoothstep(u_brush.w, u_brush.z, d)) * 0.14;
  float coverage = max(outer, max(inner, fill)) * step(d, u_brush.z + ringWidth);
  return mix(color, u_brushColor, coverage * u_brushEnabled);
}

out vec4 fragColor;

void main() {

  vec3 positionDx = dFdx(v_worldPosition);
  vec3 positionDy = dFdy(v_worldPosition);
  vec3 localDx = dFdx(v_localPosition);
  vec3 localDy = dFdy(v_localPosition);
  float brushDistance = distance(v_localPosition.xz, u_brush.xy);
  float brushRingWidth = max(fwidth(brushDistance) * 1.5, u_brush.z * 0.012);
  float edgeDistance = u_halfSize - max(abs(v_localPosition.x), abs(v_localPosition.z));
  float edgeWidth = max(fwidth(edgeDistance) * 1.5, u_halfSize * 0.003);

  vec3 Ng = normalize(v_localNormal);



  vec2 offset = v_localPosition.xz - u_cacheCenter;
  float radius = max(abs(offset.x), abs(offset.y)) / u_cache.y;
  float ringLog = floor(log2(max(radius, 1e-5)));
  float within = radius / exp2(ringLog + 1.0);
  float lodDistance = ringLog + 1.0 + smoothstep(RING_BLEND_START, 1.0, within);
  float footprint = max(length(localDx.xz), length(localDy.xz)) * u_cache.z;
  float lodFootprint = log2(max(footprint, 1e-5));
  float lod = clamp(max(lodDistance, lodFootprint), 0.0, u_cache.x);
  int level = int(floor(lod));
  int nextLevel = min(level + 1, int(u_cache.x));
  float levelMix = fract(lod);

  vec3 albedo = vec3(0.0);
  vec3 normal = Ng;
  float roughness = 1.0;
  float occlusion = 1.0;
  bool cached = false;
  if (u_cacheEnabled > 0.5) {
    CacheSample fine = sampleCacheLevel(level, v_localPosition.xz);
    CacheSample coarse = sampleCacheLevel(nextLevel, v_localPosition.xz);

    float t = fine.valid ? (coarse.valid ? levelMix : 0.0) : 1.0;
    cached = fine.valid || coarse.valid;
    albedo = mix(fine.albedo, coarse.albedo, t);
    normal = normalize(mix(fine.normal, coarse.normal, t));
    roughness = mix(fine.roughness, coarse.roughness, t);
    occlusion = mix(fine.occlusion, coarse.occlusion, t);
  }

  if (!cached) {



    float cachedFar = mix(u_cacheLevels[level].w, u_cacheLevels[nextLevel].w, levelMix);
    float far = u_cacheEnabled > 0.5 ? cachedFar : smoothstep(u_distanceBlend.x, u_distanceBlend.y, distance(v_worldPosition, u_cameraPosition));
    Footprint f = terrainFootprint(v_localPosition, localDx, localDy, Ng, far);
    TerrainMaterial m = evaluateTerrainMaterial(f, Ng, v_uv);
    albedo = m.albedo;
    normal = m.normal;
    roughness = m.roughness;
    occlusion = m.occlusion;
  }

  vec3 N = normalize(u_normalMatrix * normal);
  if (!gl_FrontFacing) N = -N;

  Surface s = makeSurface(N, v_worldPosition, albedo, roughness, 0.0);
  vec3 hdr = shadeSurface(s, v_worldPosition, positionDx, positionDy, occlusion, vec3(0.0), u_receiveShadows);
  vec3 color = finishSurfaceColor(hdr, s, 0.0);

  color = applyBrush(color, v_localPosition.xz, brushRingWidth);
  float outline = (1.0 - smoothstep(0.0, edgeWidth, edgeDistance)) * u_outline;
  color = mix(color, SELECTION_TINT, outline * 0.9);
  fragColor = vec4(color, 1.0);
}
`;
