export const COLOR_CHUNK = `

vec3 tonemapAces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}


vec3 tonemapAcesInverse(vec3 y) {
  y = min(y, vec3(0.985));
  vec3 qa = y * 2.43 - 2.51;
  vec3 qb = y * 0.59 - 0.03;
  vec3 qc = y * 0.14;
  return (-qb - sqrt(max(qb * qb - 4.0 * qa * qc, vec3(0.0)))) / (2.0 * qa);
}

vec3 linearToSrgb(vec3 c) {
  vec3 low = c * 12.92;
  vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(low, high, step(vec3(0.0031308), c));
}

vec3 srgbToLinear(vec3 c) {
  vec3 low = c / 12.92;
  vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(low, high, step(vec3(0.04045), c));
}
`;
