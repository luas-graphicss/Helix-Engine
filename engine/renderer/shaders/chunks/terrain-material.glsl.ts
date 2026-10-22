import { MAX_TERRAIN_LAYERS } from '@/engine/terrain/core/splat-map';
export const TERRAIN_MATERIAL_CHUNK = `
uniform sampler2D u_splat0;
uniform sampler2D u_splat1;
uniform sampler2DArray u_albedoArray;
uniform sampler2DArray u_normalArray;
uniform sampler2DArray u_ormhArray;
uniform int u_layerCount;

uniform vec4 u_layerParams[${MAX_TERRAIN_LAYERS}];
uniform vec3 u_layerTint[${MAX_TERRAIN_LAYERS}];
uniform float u_splatResolution;

uniform sampler2D u_grassMap;

uniform vec2 u_grassMapInfo;

uniform vec3 u_grassShade;
uniform float u_heightBlendDepth;

uniform vec2 u_triplanar;

uniform vec2 u_macro;

uniform float u_farTiling;

const int MAX_LAYERS = ${MAX_TERRAIN_LAYERS};
const float WEIGHT_EPSILON = 0.004;
const vec3 AXIS_X = vec3(1.0, 0.0, 0.0);
const vec3 AXIS_Y = vec3(0.0, 1.0, 0.0);
const vec3 AXIS_Z = vec3(0.0, 0.0, 1.0);


struct Footprint {
  vec3 p;
  vec3 dx;
  vec3 dy;

  vec3 blend;

  float far;
};

struct TerrainMaterial {
  vec3 albedo;

  vec3 normal;
  float roughness;
  float occlusion;
};


Footprint terrainFootprint(vec3 p, vec3 dx, vec3 dy, vec3 Ng, float far) {
  Footprint f;
  f.p = p;
  f.dx = dx;
  f.dy = dy;
  f.far = far;
  f.blend = AXIS_Y;
  float slope = 1.0 - abs(Ng.y);
  float triplanarAmount = smoothstep(u_triplanar.x, u_triplanar.x + u_triplanar.y, slope);
  if (triplanarAmount > 0.0) {
    vec3 w = pow(abs(Ng), vec3(4.0));
    w /= w.x + w.y + w.z;
    f.blend = mix(AXIS_Y, w, triplanarAmount);
  }
  return f;
}

vec4 sampleScaled(sampler2DArray tex, int layer, float invTiling, Footprint f) {
  vec4 result = vec4(0.0);
  if (f.blend.y > 0.0) {
    result += textureGrad(tex, vec3(f.p.xz * invTiling, layer), f.dx.xz * invTiling, f.dy.xz * invTiling) * f.blend.y;
  }
  if (f.blend.x > 0.0) {
    result += textureGrad(tex, vec3(vec2(f.p.z, -f.p.y) * invTiling, layer), vec2(f.dx.z, -f.dx.y) * invTiling, vec2(f.dy.z, -f.dy.y) * invTiling) * f.blend.x;
  }
  if (f.blend.z > 0.0) {
    result += textureGrad(tex, vec3(vec2(f.p.x, -f.p.y) * invTiling, layer), vec2(f.dx.x, -f.dx.y) * invTiling, vec2(f.dy.x, -f.dy.y) * invTiling) * f.blend.z;
  }
  return result;
}


vec4 sampleProjected(sampler2DArray tex, int layer, float invTiling, Footprint f) {
  if (f.far <= 0.0) return sampleScaled(tex, layer, invTiling, f);
  vec4 far = sampleScaled(tex, layer, invTiling * u_farTiling, f);
  if (f.far >= 1.0) return far;
  return mix(sampleScaled(tex, layer, invTiling, f), far, f.far);
}

vec3 decodeNormal(vec4 texel, float strength) {
  vec3 n = texel.xyz * 2.0 - 1.0;
  n.xy *= strength;
  return n;
}


vec3 sampleScaledNormal(int layer, float invTiling, float strength, vec3 Ng, Footprint f) {
  vec3 n = vec3(0.0);
  if (f.blend.y > 0.0) {
    vec3 m = decodeNormal(textureGrad(u_normalArray, vec3(f.p.xz * invTiling, layer), f.dx.xz * invTiling, f.dy.xz * invTiling), strength);
    n += (AXIS_X * m.x - AXIS_Z * m.y + Ng * m.z) * f.blend.y;
  }
  if (f.blend.x > 0.0) {
    vec3 m = decodeNormal(textureGrad(u_normalArray, vec3(vec2(f.p.z, -f.p.y) * invTiling, layer), vec2(f.dx.z, -f.dx.y) * invTiling, vec2(f.dy.z, -f.dy.y) * invTiling), strength);
    n += (AXIS_Z * m.x + AXIS_Y * m.y + Ng * m.z) * f.blend.x;
  }
  if (f.blend.z > 0.0) {
    vec3 m = decodeNormal(textureGrad(u_normalArray, vec3(vec2(f.p.x, -f.p.y) * invTiling, layer), vec2(f.dx.x, -f.dx.y) * invTiling, vec2(f.dy.x, -f.dy.y) * invTiling), strength);
    n += (AXIS_X * m.x + AXIS_Y * m.y + Ng * m.z) * f.blend.z;
  }
  return n;
}


vec3 sampleProjectedNormal(int layer, float invTiling, float strength, vec3 Ng, Footprint f) {
  if (f.far <= 0.0) return sampleScaledNormal(layer, invTiling, strength, Ng, f);
  vec3 far = sampleScaledNormal(layer, invTiling * u_farTiling, strength * 0.5, Ng, f);
  if (f.far >= 1.0) return far;
  return mix(sampleScaledNormal(layer, invTiling, strength, Ng, f), far, f.far);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}


float macroNoise(vec2 p) {
  return valueNoise(p) * 0.65 + valueNoise(p * 2.7 + 13.1) * 0.35;
}


TerrainMaterial evaluateTerrainMaterial(Footprint f, vec3 Ng, vec2 uv) {

  vec2 splatUv = (uv * (u_splatResolution - 1.0) + 0.5) / u_splatResolution;
  vec4 s0 = texture(u_splat0, splatUv);
  vec4 s1 = texture(u_splat1, splatUv);
  float weights[MAX_LAYERS];
  weights[0] = s0.r; weights[1] = s0.g; weights[2] = s0.b; weights[3] = s0.a;
  weights[4] = s1.r; weights[5] = s1.g; weights[6] = s1.b; weights[7] = s1.a;
  float total = 0.0;
  for (int i = 0; i < MAX_LAYERS; i++) {
    if (i >= u_layerCount) weights[i] = 0.0;
    total += weights[i];
  }
  if (total < 1e-4) {
    weights[0] = 1.0;
    total = 1.0;
  }


  vec4 ormh[MAX_LAYERS];
  float heights[MAX_LAYERS];
  float maxHeight = 0.0;
  for (int i = 0; i < MAX_LAYERS; i++) {
    float w = weights[i] / total;
    weights[i] = w;
    heights[i] = -1.0;
    if (w < WEIGHT_EPSILON) continue;
    ormh[i] = sampleProjected(u_ormhArray, i, u_layerParams[i].x, f);
    heights[i] = ormh[i].b + w;
    maxHeight = max(maxHeight, heights[i]);
  }

  float blended[MAX_LAYERS];
  float blendedTotal = 0.0;
  for (int i = 0; i < MAX_LAYERS; i++) {
    blended[i] = heights[i] < 0.0 ? 0.0 : max(heights[i] - maxHeight + u_heightBlendDepth, 0.0);
    blendedTotal += blended[i];
  }


  vec3 albedo = vec3(0.0);
  vec3 normal = vec3(0.0);
  float roughness = 0.0;
  float occlusion = 0.0;
  for (int i = 0; i < MAX_LAYERS; i++) {
    float w = blended[i] / blendedTotal;
    if (w < WEIGHT_EPSILON) continue;
    vec4 params = u_layerParams[i];
    albedo += sampleProjected(u_albedoArray, i, params.x, f).rgb * u_layerTint[i] * w;
    normal += sampleProjectedNormal(i, params.x, params.y, Ng, f) * w;
    roughness += clamp(ormh[i].g * params.z, 0.0, 1.0) * w;
    occlusion += ormh[i].r * w;
  }



  float macro = macroNoise(f.p.xz * u_macro.y) * 0.7 + valueNoise(f.p.xz * u_macro.y * 4.7 + 7.3) * 0.3;
  vec3 hueShift = mix(vec3(0.94, 0.99, 1.05), vec3(1.06, 1.02, 0.93), macro);
  albedo *= mix(vec3(1.0), hueShift, u_macro.x) * (1.0 + (macro - 0.5) * u_macro.x * 1.2);


  if (u_grassMapInfo.y > 0.0) {
    float grassSupport = 0.0;
    for (int i = 0; i < MAX_LAYERS; i++) grassSupport += weights[i] * u_layerParams[i].w;
    vec2 grassUv = (uv * (u_grassMapInfo.x - 1.0) + 0.5) / u_grassMapInfo.x;
    float grassCover = texture(u_grassMap, grassUv).r * clamp(grassSupport, 0.0, 1.0) * u_grassMapInfo.y;
    albedo *= mix(vec3(1.0), u_grassShade, grassCover);
  }

  TerrainMaterial m;
  m.albedo = albedo;
  m.normal = dot(normal, normal) > 1e-6 ? normalize(normal) : Ng;
  m.roughness = roughness;
  m.occlusion = occlusion;
  return m;
}
`;
