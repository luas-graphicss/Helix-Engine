import { ATMOSPHERE_CHUNK } from './atmosphere.glsl';
import { HDR_ENCODING_CHUNK, HDR_RANGE_SCATTERING } from '../chunks/hdr-encoding.glsl';
export const MULTI_SCATTERING_LUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_transmittanceLut;

${ATMOSPHERE_CHUNK}
${HDR_ENCODING_CHUNK}

const int SQRT_DIRECTIONS = 8;
const int STEPS = 20;
const float ISOTROPIC_PHASE = 1.0 / (4.0 * PI);

out vec4 fragColor;

void main() {
  vec2 unit = (gl_FragCoord.xy - 0.5) / (MULTI_SCATTERING_LUT_SIZE - 1.0);
  float muLight = unit.x * 2.0 - 1.0;
  float r = PLANET_RADIUS_KM + 0.001 + unit.y * (ATMOSPHERE_RADIUS_KM - PLANET_RADIUS_KM - 0.001);
  vec3 lightDir = vec3(sqrt(max(1.0 - muLight * muLight, 0.0)), muLight, 0.0);
  vec3 origin = vec3(0.0, r, 0.0);

  vec3 secondOrder = vec3(0.0);
  vec3 transfer = vec3(0.0);

  for (int i = 0; i < SQRT_DIRECTIONS; i++) {
    for (int j = 0; j < SQRT_DIRECTIONS; j++) {
      float cosTheta = 1.0 - 2.0 * (float(i) + 0.5) / float(SQRT_DIRECTIONS);
      float sinTheta = sqrt(max(1.0 - cosTheta * cosTheta, 0.0));
      float phi = 2.0 * PI * (float(j) + 0.5) / float(SQRT_DIRECTIONS);
      vec3 dir = vec3(sinTheta * cos(phi), cosTheta, sinTheta * sin(phi));

      float tGround = raySphere(origin, dir, PLANET_RADIUS_KM);
      float tTop = raySphere(origin, dir, ATMOSPHERE_RADIUS_KM);
      bool hitsGround = tGround > 0.0;
      float tMax = hitsGround ? tGround : max(tTop, 0.0);
      float dt = tMax / float(STEPS);

      vec3 throughput = vec3(1.0);
      for (int k = 0; k < STEPS; k++) {
        vec3 p = origin + dir * ((float(k) + 0.5) * dt);
        float pr = length(p);
        Medium m = sampleMedium(pr - PLANET_RADIUS_KM);
        vec3 scattering = m.rayleigh + vec3(m.mie);
        vec3 safeExtinction = max(m.extinction, vec3(1e-7));
        vec3 segment = exp(-m.extinction * dt);

        vec3 inScatter = scattering * ISOTROPIC_PHASE * transmittanceToLight(u_transmittanceLut, p, lightDir);
        secondOrder += throughput * (inScatter - inScatter * segment) / safeExtinction;
        transfer += throughput * (scattering - scattering * segment) / safeExtinction;
        throughput *= segment;
      }

      if (hitsGround) {
        vec3 p = origin + dir * tGround;
        vec3 normal = normalize(p);
        secondOrder += throughput * GROUND_ALBEDO / PI * transmittanceToLight(u_transmittanceLut, p, lightDir) * max(dot(normal, lightDir), 0.0);
      }
    }
  }

  float inverseCount = 1.0 / float(SQRT_DIRECTIONS * SQRT_DIRECTIONS);
  secondOrder *= inverseCount;
  transfer *= inverseCount;

  vec3 psi = secondOrder / max(vec3(1.0) - transfer, vec3(1e-4));
  fragColor = encodeHdr(psi, 1.0, ${HDR_RANGE_SCATTERING}.0);
}
`;
