export const SHADOW_MASK_DISTANCE_OCTAVES = 17;
export const SHADOW_MASK_ENCODING_CHUNK = `
const float SHADOW_MASK_DISTANCE_OCTAVES = ${SHADOW_MASK_DISTANCE_OCTAVES.toFixed(1)};
const float SHADOW_MASK_UNIT = 65535.0;

                                                                     
float packShadowMaskDistance(float viewDistance) {
  return clamp(log2(1.0 + max(viewDistance, 0.0)) / SHADOW_MASK_DISTANCE_OCTAVES, 0.0, 1.0);
}

float unpackShadowMaskDistance(float packed) {
  return exp2(packed * SHADOW_MASK_DISTANCE_OCTAVES) - 1.0;
}

                                                                                                               
highp uvec4 encodeShadowMask(vec4 mask) {
  return uvec4(clamp(mask, 0.0, 1.0) * SHADOW_MASK_UNIT + 0.5);
}

                                                                                         
vec4 decodeShadowMask(highp uvec4 texel) {
  vec4 mask = vec4(texel) / SHADOW_MASK_UNIT;
  mask.b = unpackShadowMaskDistance(mask.b);
  return mask;
}
`;
