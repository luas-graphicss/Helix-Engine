import { ATMOSPHERE_CHUNK, SKY_LIGHTING_TEXEL } from './atmosphere.glsl';
import { COLOR_CHUNK } from '../chunks/color.glsl';
import { HDR_ENCODING_CHUNK, HDR_RANGE_LIGHTING, HDR_RANGE_SKY } from '../chunks/hdr-encoding.glsl';
import { NOISE_CHUNK } from '../chunks/noise.glsl';
export const SKY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_nearPoint;
in vec3 v_farPoint;

uniform sampler2D u_skyViewLut;
uniform sampler2D u_skyLightingLut;
uniform sampler2D u_clouds;
uniform float u_cloudsEnabled;
uniform vec2 u_inverseResolution;
uniform vec3 u_sunDirection;
uniform vec3 u_moonDirection;
uniform vec3 u_sunIrradiance;
uniform float u_sunAngularRadius;
uniform float u_moonAngularRadius;
uniform mat3 u_starRotation;
uniform float u_starsIntensity;
uniform float u_pixelAngle;
uniform float u_time;
uniform float u_exposure;

${ATMOSPHERE_CHUNK}
${HDR_ENCODING_CHUNK}
${NOISE_CHUNK}
${COLOR_CHUNK}

const float SUN_DISK_RADIANCE = 25.0;
const float MOON_DISK_BOOST = 5.0;
const float STAR_CELLS = 110.0;
const vec3 MILKY_WAY_NORMAL = normalize(vec3(0.32, 0.58, 0.75));
const vec3 AIRGLOW = vec3(0.0012, 0.0016, 0.0028);

out vec4 fragColor;

float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash33(i).x;
  float n100 = hash33(i + vec3(1.0, 0.0, 0.0)).x;
  float n010 = hash33(i + vec3(0.0, 1.0, 0.0)).x;
  float n110 = hash33(i + vec3(1.0, 1.0, 0.0)).x;
  float n001 = hash33(i + vec3(0.0, 0.0, 1.0)).x;
  float n101 = hash33(i + vec3(1.0, 0.0, 1.0)).x;
  float n011 = hash33(i + vec3(0.0, 1.0, 1.0)).x;
  float n111 = hash33(i + vec3(1.0, 1.0, 1.0)).x;
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}

vec3 sunDisk(vec3 dir, vec3 sunTransmittance) {
  float cosAngle = dot(dir, u_sunDirection);
  float cosRadius = cos(u_sunAngularRadius);
  float edge = u_pixelAngle * sin(u_sunAngularRadius) + 1e-7;
  float disk = smoothstep(cosRadius - edge, cosRadius + edge, cosAngle);

   
  float r = clamp(acos(min(cosAngle, 1.0)) / u_sunAngularRadius, 0.0, 1.0);
  float mu = sqrt(max(1.0 - r * r, 0.0));
  vec3 limb = 1.0 - vec3(0.45, 0.6, 0.78) * (1.0 - mu);

  float forward = max(cosAngle, 0.0);
  float glare = pow(forward, 1500.0) * 0.08 + pow(forward, 120.0) * 0.012;
  return u_sunIrradiance * sunTransmittance * (disk * limb * SUN_DISK_RADIANCE + glare);
}

vec3 moonDisk(vec3 dir, vec3 moonTransmittance) {
  float cosAngle = dot(dir, u_moonDirection);
  if (cosAngle < cos(u_moonAngularRadius * 1.05)) return vec3(0.0);

  vec3 reference = abs(u_moonDirection.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(u_moonDirection, reference));
  vec3 up = cross(right, u_moonDirection);
  float sinRadius = sin(u_moonAngularRadius);
  vec2 o = vec2(dot(dir, right), dot(dir, up)) / sinRadius;
  float r2 = dot(o, o);
  float edge = 2.0 * u_pixelAngle / sinRadius + 1e-4;
  float disk = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r2);
  if (disk <= 0.0) return vec3(0.0);

   
  vec3 normal = right * o.x + up * o.y - u_moonDirection * sqrt(max(1.0 - r2, 0.0));
  float lit = max(dot(normal, u_sunDirection), 0.0);
  float mare = valueNoise3(normal * 2.5 + 7.0) * 0.6 + valueNoise3(normal * 6.0 + 3.0) * 0.4;
  float albedo = mix(0.07, 0.16, smoothstep(0.35, 0.7, mare));
  float earthshine = 0.012;

  vec3 radiance = u_sunIrradiance * (albedo / PI) * (lit + earthshine) * MOON_DISK_BOOST;
  return radiance * moonTransmittance * disk;
}

vec3 stars(vec3 worldDir) {
  vec3 d = u_starRotation * worldDir;

  float band = dot(d, MILKY_WAY_NORMAL);
  float bandMask = exp(-band * band / 0.05);
  float cloudiness = valueNoise3(d * 4.0) * 0.6 + valueNoise3(d * 9.0) * 0.4;
  float dust = smoothstep(0.35, 0.6, valueNoise3(d * 7.0 + 11.0));
  vec3 milkyWay = vec3(0.6, 0.64, 0.78) * 0.006 * bandMask * (0.4 + cloudiness) * (0.35 + 0.65 * dust);

  vec3 p = d * STAR_CELLS;
  vec3 cell = floor(p);
  vec3 position = hash33(cell);
  vec3 traits = hash33(cell + 17.0);
  vec3 starDir = normalize(cell + 0.5 + (position - 0.5) * 0.6);
  float sinAngle = length(cross(d, starDir));
  float radius = u_pixelAngle * 0.9;
  float profile = exp(-(sinAngle * sinAngle) / (radius * radius));

  float density = 0.5 + 0.4 * bandMask;
  float present = step(traits.y, density);
  float magnitude = pow(traits.x, 9.0) * 3.0 + traits.x * traits.x * 0.08;
  vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.6), traits.z);
  float twinkle = 1.0 - 0.3 * (1.0 - max(worldDir.y, 0.0)) * (0.5 + 0.5 * sin(u_time * (2.0 + 5.0 * traits.y) + traits.x * 60.0));

  return (tint * magnitude * profile * present * twinkle + milkyWay) * u_starsIntensity;
}

void main() {
  vec3 dir = normalize(v_farPoint - v_nearPoint);
  vec4 skyTexel = decodeHdr(texture(u_skyViewLut, skyViewUv(dir)), ${HDR_RANGE_SKY}.0);
  vec3 radiance = skyTexel.rgb;
  float spaceTransmittance = skyTexel.a;

  if (spaceTransmittance > 0.0) {
    vec3 sunTransmittance = decodeHdr(texelFetch(u_skyLightingLut, ivec2(${SKY_LIGHTING_TEXEL.sunTransmittance}, 0), 0), ${HDR_RANGE_LIGHTING}.0).rgb;
    vec3 moonTransmittance = decodeHdr(texelFetch(u_skyLightingLut, ivec2(${SKY_LIGHTING_TEXEL.moonTransmittance}, 0), 0), ${HDR_RANGE_LIGHTING}.0).rgb;
    radiance += sunDisk(dir, sunTransmittance) + moonDisk(dir, moonTransmittance);
    if (u_starsIntensity > 0.0005) {
      radiance += (stars(dir) + AIRGLOW * (1.0 + 2.0 * (1.0 - max(dir.y, 0.0)))) * spaceTransmittance;
    }
  }

  if (u_cloudsEnabled > 0.5) {
    vec4 clouds = decodeHdr(texture(u_clouds, gl_FragCoord.xy * u_inverseResolution), ${HDR_RANGE_SKY}.0);
    radiance = clouds.rgb + radiance * clouds.a;
  }

  vec3 color = linearToSrgb(tonemapAces(radiance * u_exposure));
  color += (interleavedGradientNoise(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = vec4(color, 1.0);
}
`;
