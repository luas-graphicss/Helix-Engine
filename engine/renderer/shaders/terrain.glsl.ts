import { SCENE_LIGHTING_CHUNK } from './chunks/scene-lighting.glsl';
import { TERRAIN_VERTEX_CHUNK } from './chunks/terrain-vertex.glsl';
import { MAX_TERRAIN_LAYERS } from '@/engine/terrain/core/splat-map';
export const TERRAIN_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

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

in vec3 v_worldPosition;
in vec3 v_localPosition;
in vec3 v_localNormal;
in vec2 v_uv;

uniform sampler2D u_splat0;
uniform sampler2D u_splat1;
uniform sampler2DArray u_albedoArray;
uniform sampler2DArray u_normalArray;
uniform sampler2DArray u_ormhArray;
uniform int u_layerCount;
 
uniform vec4 u_layerParams[${MAX_TERRAIN_LAYERS}];
uniform vec3 u_layerTint[${MAX_TERRAIN_LAYERS}];
uniform float u_splatResolution;
uniform float u_halfSize;
uniform float u_heightBlendDepth;
 
uniform vec2 u_triplanar;
 
uniform vec2 u_macro;
 
uniform vec3 u_distance;
uniform mat3 u_normalMatrix;
 
uniform vec4 u_brush;
uniform vec3 u_brushColor;
uniform float u_brushEnabled;
uniform float u_outline;
uniform float u_receiveShadows;

${SCENE_LIGHTING_CHUNK}

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
  vec4 far = sampleScaled(tex, layer, invTiling * u_distance.z, f);
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
  vec3 far = sampleScaledNormal(layer, invTiling * u_distance.z, strength * 0.5, Ng, f);
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
  Footprint f;
  f.p = v_localPosition;
  f.dx = dFdx(v_localPosition);
  f.dy = dFdy(v_localPosition);
  float brushDistance = distance(v_localPosition.xz, u_brush.xy);
  float brushRingWidth = max(fwidth(brushDistance) * 1.5, u_brush.z * 0.012);
  float edgeDistance = u_halfSize - max(abs(v_localPosition.x), abs(v_localPosition.z));
  float edgeWidth = max(fwidth(edgeDistance) * 1.5, u_halfSize * 0.003);

  vec3 Ng = normalize(v_localNormal);
  float slope = 1.0 - abs(Ng.y);
  float triplanarAmount = smoothstep(u_triplanar.x, u_triplanar.x + u_triplanar.y, slope);
  f.far = smoothstep(u_distance.x, u_distance.y, distance(v_worldPosition, u_cameraPosition));
  f.blend = AXIS_Y;
  if (triplanarAmount > 0.0) {
    vec3 w = pow(abs(Ng), vec3(4.0));
    w /= w.x + w.y + w.z;
    f.blend = mix(AXIS_Y, w, triplanarAmount);
  }

   
  vec2 splatUv = (v_uv * (u_splatResolution - 1.0) + 0.5) / u_splatResolution;
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

   
   
  float macro = macroNoise(v_localPosition.xz * u_macro.y) * 0.7 + valueNoise(v_localPosition.xz * u_macro.y * 4.7 + 7.3) * 0.3;
  vec3 hueShift = mix(vec3(0.94, 0.99, 1.05), vec3(1.06, 1.02, 0.93), macro);
  albedo *= mix(vec3(1.0), hueShift, u_macro.x) * (1.0 + (macro - 0.5) * u_macro.x * 1.2);

  vec3 N = normalize(u_normalMatrix * (dot(normal, normal) > 1e-6 ? normalize(normal) : Ng));
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
