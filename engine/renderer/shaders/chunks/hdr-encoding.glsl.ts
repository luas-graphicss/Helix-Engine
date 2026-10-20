export const HDR_RANGE_SKY = 32;
export const HDR_RANGE_LIGHTING = 4;
export const HDR_RANGE_SCATTERING = 1;
export const HDR_ENCODING_CHUNK = `
#ifdef HDR_ENCODED
vec4 encodeHdr(vec3 color, float alpha, float range) {
  return vec4(sqrt(clamp(color / range, 0.0, 1.0)), alpha);
}
vec4 decodeHdr(vec4 texel, float range) {
  return vec4(texel.rgb * texel.rgb * range, texel.a);
}
#else
vec4 encodeHdr(vec3 color, float alpha, float range) {
  return vec4(color, alpha);
}
vec4 decodeHdr(vec4 texel, float range) {
  return texel;
}
#endif
`;
