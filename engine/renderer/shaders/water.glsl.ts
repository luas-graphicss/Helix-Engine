import { SCENE_LIGHTING_CHUNK } from './chunks/scene-lighting.glsl';
import { HDR_RANGE_SKY } from './chunks/hdr-encoding.glsl';
import { SKY_LIGHTING_TEXEL, SKY_VIEW_LUT_SIZE } from './sky/atmosphere.glsl';
import { GERSTNER_WAVES_GLSL } from '@/engine/terrain/water/gerstner-waves';
export const WATER_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_grid;

uniform mat4 u_viewProjection;
uniform mat4 u_model;
uniform float u_halfSize;
uniform float u_level;

uniform vec4 u_wave;

uniform vec2 u_waveDirection;

uniform float u_gridCell;

uniform float u_foamPersistence;

out vec3 v_worldPosition;
out vec3 v_localPosition;

out vec2 v_restPosition;
out vec3 v_waveNormal;

out vec4 v_waveData;

const float PI = 3.14159265359;
${GERSTNER_WAVES_GLSL}

vec2 rotate(vec2 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

struct WaveTerm {
  vec2 dir;
  float k;
  float omega;
  float amplitude;

  float q;
};


WaveTerm waveTerm(int i, float totalAmplitude, float cell) {
  WaveTerm w;
  w.dir = rotate(u_waveDirection, WAVES[i].x);
  float wavelength = max(u_wave.y * WAVES[i].y, MIN_WAVELENGTH);

  float resolvable = smoothstep(2.0 * cell, 4.0 * cell, wavelength);
  w.amplitude = totalAmplitude * WAVES[i].z / AMPLITUDE_SUM * resolvable;
  w.k = 2.0 * PI / wavelength;
  w.omega = sqrt(GRAVITY * w.k);
  w.q = w.amplitude > 1e-6 ? u_wave.w / (w.k * w.amplitude * float(WAVE_COUNT)) : 0.0;
  return w;
}


float surfaceJacobian(vec2 p, float t, float totalAmplitude, float cell) {
  float compression = 0.0;
  for (int i = 0; i < WAVE_COUNT; i++) {
    WaveTerm w = waveTerm(i, totalAmplitude, cell);
    if (w.amplitude <= 1e-6) continue;
    compression += w.q * w.k * w.amplitude * sin(w.k * dot(w.dir, p) - w.omega * t);
  }
  return 1.0 - compression;
}

void main() {
  vec2 p = mix(vec2(-u_halfSize), vec2(u_halfSize), a_grid);
  float totalAmplitude = u_wave.x * 0.5;
  float t = u_wave.z;
  vec3 offset = vec3(0.0);
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  float compression = 0.0;

  float cell = u_gridCell > 0.0 ? u_gridCell : max(2.0 * u_halfSize / 320.0, 1.0);
  bool hasWaves = totalAmplitude > 1e-4;

  if (hasWaves) {
    for (int i = 0; i < WAVE_COUNT; i++) {
      WaveTerm w = waveTerm(i, totalAmplitude, cell);
      if (w.amplitude <= 1e-6) continue;
      float f = w.k * dot(w.dir, p) - w.omega * t;
      float s = sin(f);
      float c = cos(f);
      float qa = w.q * w.amplitude;
      float ka = w.k * w.amplitude;
      offset += vec3(qa * w.dir.x * c, w.amplitude * s, qa * w.dir.y * c);
      tangent += vec3(-w.q * w.dir.x * w.dir.x * ka * s, w.dir.x * ka * c, -w.q * w.dir.x * w.dir.y * ka * s);
      binormal += vec3(-w.q * w.dir.x * w.dir.y * ka * s, w.dir.y * ka * c, -w.q * w.dir.y * w.dir.y * ka * s);
      compression += w.q * ka * s;
    }
  }

  vec3 local = vec3(p.x + offset.x, u_level + offset.y, p.y + offset.z);
  vec4 world = u_model * vec4(local, 1.0);
  v_worldPosition = world.xyz;
  v_localPosition = local;
  v_restPosition = p;
  v_waveNormal = normalize(cross(binormal, tangent));

  float jacobian = 1.0 - compression;
  float crest = hasWaves ? clamp(offset.y / totalAmplitude * 0.5 + 0.5, 0.0, 1.0) : 0.0;

  float halfLife = u_foamPersistence * 0.5;
  vec2 past = hasWaves && halfLife > 0.0
    ? vec2(surfaceJacobian(p, t - halfLife, totalAmplitude, cell), surfaceJacobian(p, t - 2.0 * halfLife, totalAmplitude, cell))
    : vec2(jacobian);
  v_waveData = vec4(crest, jacobian, past);
  gl_Position = u_viewProjection * world;
}
`;
export const WATER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec3 v_localPosition;
in vec2 v_restPosition;
in vec3 v_waveNormal;
in vec4 v_waveData;

uniform highp sampler2D u_heightMap;
uniform float u_halfSize;
uniform float u_cellSize;
uniform int u_lastSample;
uniform mat3 u_normalMatrix;
uniform vec3 u_shallowColor;
uniform vec3 u_deepColor;

uniform vec3 u_surface;

uniform vec4 u_ripple;

uniform vec3 u_optics;

uniform vec4 u_foam;

uniform vec4 u_foamShape;
uniform vec2 u_waveDirection;

uniform vec3 u_sunDirectionLocal;

uniform sampler2D u_sceneColor;

uniform vec2 u_resolution;
uniform sampler2D u_skyViewLut;
uniform float u_skyViewEnabled;
uniform float u_receiveShadows;

${SCENE_LIGHTING_CHUNK}

const vec2 SKY_VIEW_LUT_SIZE = vec2(${SKY_VIEW_LUT_SIZE[0]}.0, ${SKY_VIEW_LUT_SIZE[1]}.0);
const float WATER_F0 = 0.02;
const float WATER_IOR = 1.333;

const float FOAM_ROUGHNESS = 0.55;

const float FOAM_WRAP = 0.45;

const float FOAM_BUMP = 0.22;


float terrainHeightAt(vec2 local) {
  vec2 g = (local + u_halfSize) / u_cellSize;
  vec2 g0 = floor(g);
  vec2 f = g - g0;
  ivec2 i0 = clamp(ivec2(g0), ivec2(0), ivec2(u_lastSample));
  ivec2 i1 = clamp(ivec2(g0) + 1, ivec2(0), ivec2(u_lastSample));
  float h00 = texelFetch(u_heightMap, ivec2(i0.x, i0.y), 0).r;
  float h10 = texelFetch(u_heightMap, ivec2(i1.x, i0.y), 0).r;
  float h01 = texelFetch(u_heightMap, ivec2(i0.x, i1.y), 0).r;
  float h11 = texelFetch(u_heightMap, ivec2(i1.x, i1.y), 0).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}


vec2 skyViewUv(vec3 dir) {
  float elevation = asin(clamp(dir.y, -1.0, 1.0));
  float u = atan(dir.x, dir.z) / (2.0 * PI) + 0.5;
  float v = 0.5 + 0.5 * sign(elevation) * sqrt(abs(elevation) / (0.5 * PI));
  return vec2(u, 0.5 / SKY_VIEW_LUT_SIZE.y + v * (1.0 - 1.0 / SKY_VIEW_LUT_SIZE.y));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}


vec3 noised(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k3 = a - b - c + d;
  float value = a + k1 * u.x + k2 * u.y + k3 * u.x * u.y;
  vec2 gradient = du * vec2(k1 + k3 * u.y, k2 + k3 * u.x);
  return vec3(value, gradient);
}

float valueNoise(vec2 p) {
  return noised(p).x;
}


vec2 worley(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float first = 8.0;
  float second = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = vec2(float(x), float(y));
      vec2 d = cell + hash22(i + cell) - f;
      float dist = dot(d, d);
      if (dist < first) {
        second = first;
        first = dist;
      } else if (dist < second) {
        second = dist;
      }
    }
  }
  return sqrt(vec2(first, second));
}


vec2 rippleSlope(vec2 p, float t, float dist) {
  vec2 wind = u_waveDirection;
  vec2 side = vec2(-wind.y, wind.x);
  vec2 slope = vec2(0.0);
  float fade0 = 1.0 - smoothstep(120.0, 600.0, dist);
  slope += noised(p * 0.35 + wind * (t * 0.45) + side * (t * 0.08)).yz * (0.35 * 0.55 * fade0);
  float fade1 = 1.0 - smoothstep(40.0, 220.0, dist);
  slope += noised(p * 1.1 - wind * (t * 0.7) + side * (t * 0.21)).yz * (1.1 * 0.3 * fade1);
  float fade2 = 1.0 - smoothstep(10.0, 70.0, dist);
  slope += noised(p * 3.3 + wind * (t * 1.3) - side * (t * 0.35)).yz * (3.3 * 0.15 * fade2);
  return slope;
}


float causticWeb(vec2 p, float t) {
  float a = 1.0 - abs(valueNoise(p * 0.9 + vec2(t * 0.21, -t * 0.17)) * 2.0 - 1.0);
  float b = 1.0 - abs(valueNoise(p * 1.4 + vec2(-t * 0.15, t * 0.24) + 7.3) * 2.0 - 1.0);
  float web = a * b;
  return web * web * web * 3.0;
}


vec3 foamPattern(vec2 p, float dist) {
  vec3 plateA = noised(p * 0.45);
  vec3 plateB = noised(p * 0.9 + 3.1);
  float plates = plateA.x * 0.6 + plateB.x * 0.4;
  vec2 gradient = plateA.yz * (0.45 * 0.6) + plateB.yz * (0.9 * 0.4);

  float coarseDetail = 1.0 - smoothstep(60.0, 250.0, dist);
  float fineDetail = 1.0 - smoothstep(15.0, 80.0, dist);
  vec2 coarse = worley(p * 1.8);
  vec2 fine = worley(p * 4.7 + 7.7);
  float coarseWeb = 1.0 - smoothstep(0.0, 0.3, coarse.y - coarse.x);
  float fineWeb = 1.0 - smoothstep(0.0, 0.4, fine.y - fine.x);
  float bubbles = mix(0.3, coarseWeb, coarseDetail) * 0.65 + mix(0.35, fineWeb, fineDetail) * 0.35;

  float value = plates * 0.6 + bubbles * 0.4;

  return vec3(clamp((value - 0.18) / 0.64, 0.0, 1.0), gradient);
}


float shoreCoverage(float depth, float width, float crest, float wash, float t) {
  float x = depth / width;
  float contact = 1.0 - smoothstep(0.0, 0.15, x);
  float band = exp(-x * 2.4) * (0.5 + 0.6 * crest);
  float phase = fract(x * 2.5 + t * 0.3 + wash * 1.3);
  float lines = smoothstep(0.0, 0.07, phase) * (1.0 - smoothstep(0.07, 0.75, phase));
  lines *= (1.0 - smoothstep(0.15, 1.1, x)) * 0.75;
  return clamp(max(contact, band + lines), 0.0, 1.0) * (1.0 - smoothstep(0.85, 1.4, x));
}


float crestCoverage(vec4 waveData, float threshold) {
  float full = threshold - 0.3;
  float now = smoothstep(threshold, full, waveData.y);
  float recent = smoothstep(threshold, full, waveData.z) * 0.7;
  float older = smoothstep(threshold, full, waveData.w) * 0.42;
  return max(now, max(recent, older));
}

out vec4 fragColor;

void main() {
  vec3 positionDx = dFdx(v_worldPosition);
  vec3 positionDy = dFdy(v_worldPosition);

  float depth = v_localPosition.y - terrainHeightAt(v_localPosition.xz);
  if (depth <= 0.0) discard;

  float time = u_ripple.y;
  float dist = length(u_cameraPosition - v_worldPosition);


  vec3 macroLocal = normalize(v_waveNormal);
  vec2 slope = rippleSlope(v_localPosition.xz, time, dist) * (u_ripple.x * 0.16);
  vec3 detailLocal = normalize(macroLocal + vec3(-slope.x, 0.0, -slope.y));
  vec3 N = normalize(u_normalMatrix * detailLocal);
  vec3 macroN = normalize(u_normalMatrix * macroLocal);
  if (!gl_FrontFacing) {
    N = -N;
    macroN = -macroN;
  }


  float roughness = mix(u_surface.z, 0.35, smoothstep(60.0, 500.0, dist));
  Surface s = makeSurface(N, v_worldPosition, vec3(0.0), roughness, 0.0);
  s.f0 = vec3(WATER_F0);
  s.diffuseColor = vec3(0.0);
  float fresnel = WATER_F0 + (1.0 - WATER_F0) * pow(1.0 - s.NdotV, 5.0);

  vec3 sunRadiance = u_sunRadiance;
  vec3 moonRadiance = u_moonRadiance;
  vec3 skyIrradiance = u_skyIrradiance;
  vec3 groundIrradiance = u_groundIrradiance;
  if (u_skyLightingEnabled > 0.5) {
    sunRadiance *= skyLightingTexel(${SKY_LIGHTING_TEXEL.sunTransmittance});
    moonRadiance *= skyLightingTexel(${SKY_LIGHTING_TEXEL.moonTransmittance});
    skyIrradiance = skyLightingTexel(${SKY_LIGHTING_TEXEL.skyIrradiance});
    groundIrradiance = skyLightingTexel(${SKY_LIGHTING_TEXEL.groundIrradiance});
  }

  bool shadowOnMoon = u_shadowOnMoon > 0.5;
  vec3 shadowLight = shadowOnMoon ? u_moonDirection : u_sunDirection;
  vec3 shadowRadiance = shadowOnMoon ? moonRadiance : sunRadiance;
  float shadowNdotL = dot(macroN, shadowLight);
  float visibility = 1.0;
  if (shadowNdotL > 0.0 && any(greaterThan(shadowRadiance, vec3(0.0)))) {

    visibility = shadowMaskVisibility(u_receiveShadows);
  }
  float sunVisibility = shadowOnMoon ? 1.0 : visibility;
  float moonVisibility = shadowOnMoon ? visibility : 1.0;
  float sunUp = max(u_sunDirection.y, 0.0);


  float foam = 0.0;
  float foamAo = 1.0;
  float bubbleVeil = 0.0;
  vec3 foamN = macroN;
  if (u_foam.y + u_foam.z > 0.0) {
    vec2 wind = u_waveDirection;
    vec2 side = vec2(-wind.y, wind.x);

    vec2 rest = v_restPosition + wind * (time * 0.12);
    vec2 fp = vec2(dot(rest, wind) * 0.55, dot(rest, side)) / max(u_foamShape.x, 0.05);
    vec3 pattern = foamPattern(fp, dist);
    float wash = noised(fp * 0.3).x;


    float steepness = PI * u_ripple.z / max(u_ripple.w, 0.2);
    float breaking = smoothstep(0.012, 0.05, steepness);
    float shore = u_foam.x > 0.0 ? shoreCoverage(depth, u_foam.x, v_waveData.x, wash, time) * u_foam.y : 0.0;
    float crest = crestCoverage(v_waveData, u_foam.w) * u_foam.z * breaking;
    float coverage = clamp(shore + crest, 0.0, 1.0) * (1.0 - 0.5 * smoothstep(150.0, 600.0, dist));


    float softness = mix(0.5, 0.08, u_foamShape.y);
    foam = smoothstep(1.0 - coverage, 1.0 - coverage + softness, pattern.x);
    foamAo = 0.72 + 0.28 * pattern.x;
    vec3 foamLocal = normalize(macroLocal + vec3(-pattern.y, 0.0, -pattern.z) * FOAM_BUMP);
    foamN = normalize(u_normalMatrix * foamLocal);
    if (!gl_FrontFacing) foamN = -foamN;


    bubbleVeil = u_foamShape.z * clamp(crest * 0.7 + shore * 0.45, 0.0, 1.0) * (0.35 + 0.65 * noised(fp * 0.35 + 11.0).x);
  }


  float sinT2 = (1.0 - s.NdotV * s.NdotV) / (WATER_IOR * WATER_IOR);
  float cosT = sqrt(max(1.0 - sinT2, 0.0));
  float optical = depth / max(cosT, 0.15) + depth;
  float clarity = max(u_surface.x, 0.05);

  vec3 tint = u_shallowColor / max(max(u_shallowColor.r, u_shallowColor.g), max(u_shallowColor.b, 1e-3));
  vec3 extinction = (0.6 + 2.4 * (1.0 - tint)) / clarity;
  vec3 transmittance = exp(-optical * extinction);
  float depthFactor = 1.0 - exp(-optical / clarity);



  vec2 texel = 1.0 / u_resolution;
  vec2 screenUv = gl_FragCoord.xy * texel;

  vec3 screenRight = cross(-s.V, vec3(0.0, 1.0, 0.0));
  screenRight = length(screenRight) > 1e-3 ? normalize(screenRight) : vec3(1.0, 0.0, 0.0);
  vec3 screenUp = cross(screenRight, -s.V);
  vec3 wobble = N - macroN;
  float reach = min(depth, 1.5) * u_optics.x;
  vec2 distortion = vec2(dot(wobble, screenRight), dot(wobble, screenUp)) * (reach * 0.12 / (1.0 + dist * 0.03));
  distortion += vec2(dot(macroN, screenRight), dot(macroN, screenUp)) * (reach * 0.06 / (1.0 + dist * 0.02));
  vec2 refractedUv = clamp(screenUv + distortion, texel, 1.0 - texel);
  vec3 sceneHdr = tonemapAcesInverse(srgbToLinear(texture(u_sceneColor, refractedUv).rgb)) / max(u_exposure, 1e-3);


  if (u_optics.y > 0.0 && sunUp > 0.0) {
    vec2 floorXz = v_localPosition.xz + detailLocal.xz * (depth * 1.5) - u_sunDirectionLocal.xz * depth;
    float web = causticWeb(floorXz * 1.6, time);
    float strength = u_optics.y * sunUp * sunVisibility * exp(-optical * 0.8 / clarity) * smoothstep(0.0, 0.3, depth);
    sceneHdr *= 1.0 + web * strength;
  }


  vec3 bodyColor = mix(u_shallowColor, u_deepColor, depthFactor);
  vec3 irradiance = skyIrradiance + sunRadiance * (sunVisibility * sunUp);
  vec3 bodyRadiance = bodyColor * irradiance / PI;
  vec3 color = sceneHdr * transmittance + bodyRadiance * (1.0 - transmittance);


  if (bubbleVeil > 0.0) {
    vec3 milk = mix(bodyColor, vec3(0.85), 0.75) * irradiance / PI;
    color = mix(color, milk, bubbleVeil * 0.75);
  }


  if (u_optics.z > 0.0) {
    float towardSun = pow(max(dot(s.V, -u_sunDirection), 0.0), 3.0);
    float crestHeight = v_waveData.x * smoothstep(0.02, 0.3, u_ripple.z);
    color += u_shallowColor * sunRadiance * (towardSun * crestHeight * (1.0 - fresnel) * u_optics.z * 0.35 * sunVisibility);
  }


  vec3 R = reflect(-s.V, N);
  R.y = max(R.y, 0.03);
  R = normalize(R);
  vec3 skyColor = u_skyViewEnabled > 0.5
    ? decodeHdr(texture(u_skyViewLut, skyViewUv(R)), ${HDR_RANGE_SKY}.0).rgb
    : mix(groundIrradiance, skyIrradiance, 0.5 + 0.5 * R.y) * 0.35;
  float reflection = fresnel * u_surface.y;
  color = mix(color, skyColor, reflection);


  if (any(greaterThan(sunRadiance, vec3(0.0)))) color += directLight(s, u_sunDirection, sunRadiance, sunVisibility);
  if (any(greaterThan(moonRadiance, vec3(0.0)))) color += directLight(s, u_moonDirection, moonRadiance, moonVisibility);


  if (foam > 0.0) {
    float albedo = u_foamShape.w * foamAo;
    Surface foamSurface = makeSurface(foamN, v_worldPosition, vec3(0.0), FOAM_ROUGHNESS, 0.0);
    foamSurface.f0 = vec3(0.03);
    float sunWrap = clamp((dot(foamN, u_sunDirection) + FOAM_WRAP) / (1.0 + FOAM_WRAP), 0.0, 1.0);
    float moonWrap = clamp((dot(foamN, u_moonDirection) + FOAM_WRAP) / (1.0 + FOAM_WRAP), 0.0, 1.0);
    vec3 foamLit = (albedo / PI) * (sunRadiance * (sunWrap * sunVisibility) + moonRadiance * (moonWrap * moonVisibility) + skyIrradiance * (0.8 + 0.2 * foamN.y));
    if (any(greaterThan(sunRadiance, vec3(0.0)))) foamLit += directLight(foamSurface, u_sunDirection, sunRadiance, sunVisibility);
    color = mix(color, foamLit, foam);
  }


  vec3 fogged = aerialPerspective(color, v_worldPosition, skyIrradiance, sunRadiance);
  float refractedShare = (1.0 - reflection) * (1.0 - foam) * dot(transmittance, vec3(1.0 / 3.0));
  color = mix(fogged, color, refractedShare);


  float alpha = max(smoothstep(0.0, 0.1, depth), foam * smoothstep(0.0, 0.015, depth));
  fragColor = vec4(finishSurfaceColor(color, s, 0.0), alpha);
}
`;
