import { ATMOSPHERE_CHUNK } from './atmosphere.glsl';
import { HDR_ENCODING_CHUNK, HDR_RANGE_SCATTERING, HDR_RANGE_SKY } from '../chunks/hdr-encoding.glsl';
export const SKY_VIEW_LUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_transmittanceLut;
uniform sampler2D u_multiScatteringLut;
uniform vec3 u_sunDirection;
uniform vec3 u_moonDirection;
uniform vec3 u_sunIrradiance;
uniform vec3 u_moonIrradiance;

${ATMOSPHERE_CHUNK}
${HDR_ENCODING_CHUNK}

const int STEPS = 32;

out vec4 fragColor;

vec3 inScatterFromLight(vec3 p, float r, vec3 viewDir, vec3 lightDir, vec3 irradiance, Medium m) {
  float cosTheta = dot(viewDir, lightDir);
  vec3 transmittance = transmittanceToLight(u_transmittanceLut, p, lightDir);
  vec3 psi = decodeHdr(texture(u_multiScatteringLut, multiScatteringLutUv(r, dot(p, lightDir) / r)), ${HDR_RANGE_SCATTERING}.0).rgb;
  vec3 single = (m.rayleigh * phaseRayleigh(cosTheta) + vec3(m.mie * phaseMie(cosTheta, MIE_ANISOTROPY))) * transmittance;
  vec3 multiple = (m.rayleigh + vec3(m.mie)) * psi;
  return (single + multiple) * irradiance;
}

vec3 groundRadiance(vec3 p, vec3 lightDir, vec3 irradiance) {
  vec3 normal = normalize(p);
  return GROUND_ALBEDO / PI * irradiance * transmittanceToLight(u_transmittanceLut, p, lightDir) * max(dot(normal, lightDir), 0.0);
}

void main() {
  float u = gl_FragCoord.x / SKY_VIEW_LUT_SIZE.x;
  float vUnit = (gl_FragCoord.y - 0.5) / (SKY_VIEW_LUT_SIZE.y - 1.0);
  vec3 dir = skyViewDirection(u, vUnit);
  vec3 origin = vec3(0.0, PLANET_RADIUS_KM + OBSERVER_ALTITUDE_KM, 0.0);

  float tGround = raySphere(origin, dir, PLANET_RADIUS_KM);
  float tTop = raySphere(origin, dir, ATMOSPHERE_RADIUS_KM);
  bool hitsGround = tGround > 0.0;
  float tMax = hitsGround ? tGround : max(tTop, 0.0);

  vec3 radiance = vec3(0.0);
  vec3 throughput = vec3(1.0);
  float previousT = 0.0;

   
  for (int i = 1; i <= STEPS; i++) {
    float x = float(i) / float(STEPS);
    float t = tMax * x * x;
    float dt = t - previousT;
    vec3 p = origin + dir * (0.5 * (t + previousT));
    previousT = t;

    float r = length(p);
    Medium m = sampleMedium(r - PLANET_RADIUS_KM);
    vec3 inScatter = inScatterFromLight(p, r, dir, u_sunDirection, u_sunIrradiance, m)
      + inScatterFromLight(p, r, dir, u_moonDirection, u_moonIrradiance, m);

    vec3 segment = exp(-m.extinction * dt);
    radiance += throughput * (inScatter - inScatter * segment) / max(m.extinction, vec3(1e-7));
    throughput *= segment;
  }

  float spaceTransmittance = 0.0;
  if (hitsGround) {
    vec3 p = origin + dir * tGround;
    radiance += throughput * (groundRadiance(p, u_sunDirection, u_sunIrradiance) + groundRadiance(p, u_moonDirection, u_moonIrradiance));
  } else {
    spaceTransmittance = dot(throughput, vec3(1.0 / 3.0));
  }

  fragColor = encodeHdr(radiance, spaceTransmittance, ${HDR_RANGE_SKY}.0);
}
`;
