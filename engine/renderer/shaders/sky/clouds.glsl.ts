import { ATMOSPHERE_CHUNK } from './atmosphere.glsl';
import { CLOUD_DENSITY_CHUNK } from '../chunks/cloud-density.glsl';
import { HDR_ENCODING_CHUNK, HDR_RANGE_LIGHTING, HDR_RANGE_SKY } from '../chunks/hdr-encoding.glsl';
import { NOISE_CHUNK } from '../chunks/noise.glsl';
export const CLOUDS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_nearPoint;
in vec3 v_farPoint;

uniform vec3 u_cameraPosition;
uniform vec3 u_sunDirection;
uniform vec3 u_moonDirection;
uniform vec3 u_sunIrradiance;
uniform vec3 u_moonIrradiance;
uniform sampler2D u_transmittanceLut;
uniform sampler2D u_skyViewLut;
uniform sampler2D u_skyLightingLut;
uniform sampler2D u_history;
uniform mat4 u_previousViewProjection;
uniform float u_historyBlend;
uniform float u_frameIndex;

uniform ivec2 u_interleaveMask;
uniform ivec2 u_quadrant;

${ATMOSPHERE_CHUNK}
${HDR_ENCODING_CHUNK}
${NOISE_CHUNK}
${CLOUD_DENSITY_CHUNK}

#ifndef CLOUD_STEPS
#define CLOUD_STEPS 40
#endif
const int LIGHT_STEPS = 5;
const float PLANET_RADIUS_M = PLANET_RADIUS_KM * 1000.0;
const float MAX_PATH_IN_THICKNESSES = 18.0;
const float SCATTERING_ALBEDO = 0.96;

out vec4 fragColor;


float curvature(float dy) {
  return (1.0 - dy * dy) / (2.0 * PLANET_RADIUS_M);
}


float distanceToAltitude(float h0, float dy, float k, float target) {
  float c = h0 - target;
  if (k < 1e-13) {
    float t = -c / dy;
    return t > 0.0 ? t : -1.0;
  }
  float discriminant = dy * dy - 4.0 * k * c;
  if (discriminant < 0.0) return -1.0;
  float q = -0.5 * (dy + (dy >= 0.0 ? 1.0 : -1.0) * sqrt(discriminant));
  float tA = q / k;
  float tB = abs(q) > 1e-20 ? c / q : -1.0;
  float tMin = min(tA, tB);
  float tMax = max(tA, tB);
  if (tMin > 0.0) return tMin;
  return tMax > 0.0 ? tMax : -1.0;
}


bool cloudSpan(float h0, float dy, float k, out float tEntry, out float tExit) {
  float base = u_cloudLayer.x;
  float top = base + u_cloudLayer.y;
  float tBase = distanceToAltitude(h0, dy, k, base);
  float tTop = distanceToAltitude(h0, dy, k, top);

  if (h0 < base) {
    tEntry = tBase;
    tExit = tTop;
  } else if (h0 > top) {
    tEntry = tTop;
    tExit = tBase;
  } else {
    tEntry = 0.0;
    tExit = dy >= 0.0 ? tTop : tBase;
  }
  if (tEntry < 0.0 || tExit < tEntry) return false;

  if (dy < 0.0) {
    if (h0 <= 0.0) return false;
    float tGround = distanceToAltitude(h0, dy, k, 0.0);
    if (tGround > 0.0 && tGround < tEntry) return false;
  }
  return true;
}

float henyeyGreenstein(float cosTheta, float g) {
  float g2 = g * g;
  float denominator = 1.0 + g2 - 2.0 * g * cosTheta;
  return (1.0 - g2) / (4.0 * PI * denominator * sqrt(denominator));
}


float cloudPhase(float cosTheta, float g) {
  return mix(henyeyGreenstein(cosTheta, g), henyeyGreenstein(cosTheta, -0.3 * g), 0.25);
}


vec4 multiScatterPhase(float cosTheta) {
  const float g = 0.8;
  return vec4(
    cloudPhase(cosTheta, g),
    cloudPhase(cosTheta, g * 0.55),
    cloudPhase(cosTheta, g * 0.55 * 0.55),
    cloudPhase(cosTheta, g * 0.55 * 0.55 * 0.55)
  );
}


float multiScatter(float opticalDepth, vec4 phase) {
  const vec4 AMPLITUDE = vec4(1.0, 0.7, 0.7 * 0.7, 0.7 * 0.7 * 0.7);
  const vec4 ATTENUATION = vec4(1.0, 0.35, 0.35 * 0.35, 0.35 * 0.35 * 0.35);
  return dot(AMPLITUDE * phase, exp(-ATTENUATION * opticalDepth));
}


float lightOpticalDepth(vec3 p, float altitude, vec3 lightDirection) {
  float kLight = curvature(lightDirection.y);
  float reach = u_cloudLayer.y * 1.2;
  float opticalDepth = 0.0;
  float previous = 0.0;
  for (int i = 0; i < LIGHT_STEPS; i++) {
    float f = float(i + 1) / float(LIGHT_STEPS);
    float s = f * f * reach;
    float ds = s - previous;
    float mid = s - ds * 0.5;
    previous = s;

    float heightFraction = cloudHeightFraction(altitude + mid * lightDirection.y + mid * mid * kLight);
    vec3 q = p + lightDirection * mid;
    float base = cloudBaseDensity(q.xz, heightFraction);
    if (base <= 0.0) continue;
    float density = i < 2 ? cloudDetailedDensity(q, heightFraction, base) : base;
    opticalDepth += density * u_cloudLayer.w * ds;
  }
  return opticalDepth;
}

vec3 aerialExtinctionPerMeter() {
  float altitudeKm = (u_cloudLayer.x + 0.5 * u_cloudLayer.y) * 0.001;
  return sampleMedium(altitudeKm).extinction * 0.001;
}

vec4 marchClouds(vec3 dir, float h0, float k, float tEntry, float tExit) {
  float pathLength = min(tExit - tEntry, u_cloudLayer.y * MAX_PATH_IN_THICKNESSES);
  float tEnd = tEntry + pathLength;
  float dt = pathLength / float(CLOUD_STEPS);
  float jitter = interleavedGradientNoise(gl_FragCoord.xy + 5.588238 * mod(u_frameIndex, 64.0));


  vec3 baseKm = vec3(0.0, PLANET_RADIUS_KM + u_cloudLayer.x * 0.001, 0.0);
  vec3 topKm = vec3(0.0, PLANET_RADIUS_KM + (u_cloudLayer.x + u_cloudLayer.y) * 0.001, 0.0);
  vec3 sunAtBase = u_sunIrradiance * transmittanceToLight(u_transmittanceLut, baseKm, u_sunDirection);
  vec3 sunAtTop = u_sunIrradiance * transmittanceToLight(u_transmittanceLut, topKm, u_sunDirection);
  vec3 moonLight = u_moonIrradiance * transmittanceToLight(u_transmittanceLut, topKm, u_moonDirection);

  bool hasSun = dot(sunAtBase + sunAtTop, vec3(1.0)) > 1e-4;
  bool hasMoon = dot(moonLight, vec3(1.0)) > 1e-4;
  vec4 sunPhase = multiScatterPhase(dot(dir, u_sunDirection));
  vec4 moonPhase = multiScatterPhase(dot(dir, u_moonDirection));
  vec3 skyAmbient = decodeHdr(texelFetch(u_skyLightingLut, ivec2(0, 0), 0), ${HDR_RANGE_LIGHTING}.0).rgb;
  vec3 groundAmbient = decodeHdr(texelFetch(u_skyLightingLut, ivec2(1, 0), 0), ${HDR_RANGE_LIGHTING}.0).rgb;

  vec3 radiance = vec3(0.0);
  float transmittance = 1.0;
  float weightedDepth = 0.0;
  float t = tEntry + jitter * dt;

  for (int i = 0; i < CLOUD_STEPS; i++) {
    if (t > tEnd || transmittance < 0.01) break;

    float altitude = h0 + t * dir.y + t * t * k;
    float heightFraction = cloudHeightFraction(altitude);
    vec3 p = u_cameraPosition + dir * t;
    float base = cloudBaseDensity(p.xz, heightFraction);
    if (base <= 0.0) {
      t += dt * 2.0;
      continue;
    }

    float density = cloudDetailedDensity(p, heightFraction, base);
    if (density > 0.0) {
      float sigma = density * u_cloudLayer.w;
      float stepTransmittance = exp(-sigma * dt);

      vec3 light = vec3(0.0);
      if (hasSun) {
        vec3 sunLight = mix(sunAtBase, sunAtTop, clamp(heightFraction, 0.0, 1.0));
        light += sunLight * multiScatter(lightOpticalDepth(p, altitude, u_sunDirection), sunPhase);
      }
      if (hasMoon) {
        light += moonLight * multiScatter(lightOpticalDepth(p, altitude, u_moonDirection), moonPhase);
      }

      light += (skyAmbient * mix(0.3, 1.0, heightFraction) + groundAmbient * mix(0.5, 0.1, heightFraction)) * (1.0 - 0.6 * base);

      vec3 stepScatter = light * SCATTERING_ALBEDO * (1.0 - stepTransmittance);
      radiance += transmittance * stepScatter;
      weightedDepth += transmittance * (1.0 - stepTransmittance) * t;
      transmittance *= stepTransmittance;
    }
    t += dt;
  }


  float opacity = 1.0 - transmittance;
  if (opacity > 1e-4) {
    float meanDepth = weightedDepth / opacity;
    vec3 aerialTransmittance = exp(-aerialExtinctionPerMeter() * meanDepth);
    vec3 skyRadiance = decodeHdr(texture(u_skyViewLut, skyViewUv(dir)), ${HDR_RANGE_SKY}.0).rgb;
    radiance = radiance * aerialTransmittance + skyRadiance * (1.0 - aerialTransmittance) * opacity;
  }

  return vec4(radiance, transmittance);
}


bool clearSky(vec3 dir, float tEntry, float tExit, vec4 history, bool reusable) {
  if (!reusable || history.a < 0.999) return false;


  if ((int(u_frameIndex) & 12) == 0) return false;
  float tEnd = tEntry + min(tExit - tEntry, u_cloudLayer.y * MAX_PATH_IN_THICKNESSES);
  for (int i = 0; i <= 3; i++) {
    float t = mix(tEntry, tEnd, float(i) / 3.0);
    if (cloudColumnHint(u_cameraPosition.xz + dir.xz * t) > 0.0) return false;
  }
  return true;
}

void main() {
  vec3 dir = normalize(v_farPoint - v_nearPoint);
  float h0 = u_cameraPosition.y;
  float k = curvature(dir.y);


  vec4 previousClip = u_previousViewProjection * vec4(dir, 0.0);
  vec2 previousNdc = previousClip.xy / previousClip.w;
  bool reusable = u_historyBlend > 0.0 && previousClip.w > 0.0 && all(lessThanEqual(abs(previousNdc), vec2(1.0)));
  vec4 history = texture(u_history, previousNdc * 0.5 + 0.5);



  bool skipped = reusable && any(notEqual(ivec2(gl_FragCoord.xy) & u_interleaveMask, u_quadrant & u_interleaveMask));
  if (skipped) {
    fragColor = history;
    return;
  }

  vec4 current = vec4(0.0, 0.0, 0.0, 1.0);
  float tEntry;
  float tExit;
  if (cloudSpan(h0, dir.y, k, tEntry, tExit) && !clearSky(dir, tEntry, tExit, history, reusable)) {
    current = marchClouds(dir, h0, k, tEntry, tExit);
  }
  current = encodeHdr(current.rgb, current.a, ${HDR_RANGE_SKY}.0);

  fragColor = mix(current, history, reusable ? u_historyBlend : 0.0);
}
`;
