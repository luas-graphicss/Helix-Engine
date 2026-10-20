import { ATMOSPHERE_CHUNK } from './atmosphere.glsl';
export const TRANSMITTANCE_LUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

${ATMOSPHERE_CHUNK}

const int STEPS = 48;

out vec4 fragColor;

void main() {
  vec2 unit = (gl_FragCoord.xy - 0.5) / (TRANSMITTANCE_LUT_SIZE - 1.0);
  float r;
  float mu;
  transmittanceLutParams(unit, r, mu);

  vec3 origin = vec3(0.0, r, 0.0);
  vec3 dir = vec3(sqrt(max(1.0 - mu * mu, 0.0)), mu, 0.0);
  float tMax = max(raySphere(origin, dir, ATMOSPHERE_RADIUS_KM), 0.0);
  float dt = tMax / float(STEPS);

  vec3 opticalDepth = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = origin + dir * ((float(i) + 0.5) * dt);
    opticalDepth += sampleMedium(length(p) - PLANET_RADIUS_KM).extinction * dt;
  }

  fragColor = vec4(exp(-opticalDepth), 1.0);
}
`;
