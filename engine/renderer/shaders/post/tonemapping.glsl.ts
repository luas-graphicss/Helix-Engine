import type { ToneMapper } from '@/engine/core/environment/post-process-settings';
export const TONE_MAPPER_INDEX: Record<ToneMapper, number> = { aces: 0, agx: 1, filmic: 2, neutral: 3, reinhard: 4, none: 5 };
export const TONEMAPPING_CHUNK = `
const vec3 LUMA_709 = vec3(0.2126, 0.7152, 0.0722);

   
                                                                                
                                                                         
   
vec3 agxDefaultContrastApprox(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

vec3 tonemapAgx(vec3 color) {
  const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
    vec3(0.6274, 0.0691, 0.0164),
    vec3(0.3293, 0.9195, 0.0880),
    vec3(0.0433, 0.0113, 0.8956)
  );
  const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
    vec3(1.6605, -0.1246, -0.0182),
    vec3(-0.5876, 1.1329, -0.1006),
    vec3(-0.0728, -0.0083, 1.1187)
  );
  const mat3 AGX_INSET = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859)
  );
  const mat3 AGX_OUTSET = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405)
  );
  const float AGX_MIN_EV = -12.47393;
  const float AGX_MAX_EV = 4.026069;

  color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
  color = AGX_INSET * color;
  color = max(color, vec3(1e-10));
  color = log2(color);
  color = (color - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV);
  color = clamp(color, 0.0, 1.0);
  color = agxDefaultContrastApprox(color);
  color = AGX_OUTSET * color;
                                                                                             
  color = pow(max(color, vec3(0.0)), vec3(2.2));
  color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
  return clamp(color, 0.0, 1.0);
}

                                                                                
vec3 hablePartial(vec3 x) {
  const float A = 0.15;
  const float B = 0.50;
  const float C = 0.10;
  const float D = 0.20;
  const float E = 0.02;
  const float F = 0.30;
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

vec3 tonemapFilmic(vec3 color) {
  vec3 curr = hablePartial(color * 2.0);
  vec3 whiteScale = vec3(1.0) / hablePartial(vec3(11.2));
  return clamp(curr * whiteScale, 0.0, 1.0);
}

                                                                                                     
vec3 tonemapNeutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return clamp(color, 0.0, 1.0);
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return clamp(mix(color, vec3(newPeak), g), 0.0, 1.0);
}

                                                                                             
vec3 tonemapReinhard(vec3 color) {
  const float white = 4.0;
  float l = dot(color, LUMA_709);
  float mapped = l * (1.0 + l / (white * white)) / (1.0 + l);
  return clamp(color * (mapped / max(l, 1e-5)), 0.0, 1.0);
}

vec3 applyToneMapper(vec3 color, int mode) {
  if (mode == 1) return tonemapAgx(color);
  if (mode == 2) return tonemapFilmic(color);
  if (mode == 3) return tonemapNeutral(color);
  if (mode == 4) return tonemapReinhard(color);
  if (mode == 5) return clamp(color, 0.0, 1.0);
  return tonemapAces(color);
}
`;
