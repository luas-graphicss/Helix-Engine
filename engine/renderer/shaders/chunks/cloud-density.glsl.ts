export const CLOUD_FOOTPRINT_TILE_METERS = 14000;
export const CLOUD_DETAIL_TILE_METERS = 600;
export const CLOUD_DENSITY_CHUNK = `
uniform sampler2D u_cloudFootprint;
uniform highp sampler3D u_cloudDetail;

uniform vec4 u_cloudLayer;

uniform vec4 u_cloudWind;
uniform float u_cloudDetailStrength;

const float CLOUD_FOOTPRINT_SCALE = 1.0 / ${CLOUD_FOOTPRINT_TILE_METERS}.0;
const float CLOUD_DETAIL_SCALE = 1.0 / ${CLOUD_DETAIL_TILE_METERS}.0;

float remap(float value, float fromMin, float fromMax, float toMin, float toMax) {
  return toMin + (value - fromMin) * (toMax - toMin) / (fromMax - fromMin);
}

float cloudHeightFraction(float altitude) {
  return (altitude - u_cloudLayer.x) / u_cloudLayer.y;
}


float cloudBaseDensity(vec2 xz, float heightFraction) {
  if (heightFraction <= 0.0 || heightFraction >= 1.0) return 0.0;

  vec4 footprint = texture(u_cloudFootprint, (xz + u_cloudWind.xy) * CLOUD_FOOTPRINT_SCALE);
  float worleyFbm = footprint.g * 0.625 + footprint.b * 0.375;
  float shape = remap(footprint.r, worleyFbm - 1.0, 1.0, 0.0, 1.0);


  float top = mix(0.4, 1.0, footprint.a);
  float profile = smoothstep(0.0, 0.07, heightFraction) * (1.0 - smoothstep(top * 0.5, top, heightFraction));

  float coverage = u_cloudLayer.z;
  float density = remap(shape * profile, 1.0 - coverage * 0.98, 1.0, 0.0, 1.0);
  return clamp(density, 0.0, 1.0) * mix(0.5, 1.0, coverage);
}


float cloudColumnHint(vec2 xz) {
  vec4 footprint = texture(u_cloudFootprint, (xz + u_cloudWind.xy) * CLOUD_FOOTPRINT_SCALE);
  float worleyFbm = footprint.g * 0.625 + footprint.b * 0.375;
  float shape = remap(footprint.r, worleyFbm - 1.0, 1.0, 0.0, 1.0);
  return remap(shape, 1.0 - u_cloudLayer.z * 0.98, 1.0, 0.0, 1.0);
}


float cloudDetailedDensity(vec3 p, float heightFraction, float baseDensity) {
  vec3 detailUv = (p + vec3(u_cloudWind.z, 0.0, u_cloudWind.w)) * CLOUD_DETAIL_SCALE;
  vec3 detail = texture(u_cloudDetail, detailUv).rgb;
  float detailFbm = detail.r * 0.625 + detail.g * 0.25 + detail.b * 0.125;
  float erosion = mix(detailFbm, 1.0 - detailFbm, clamp(heightFraction * 8.0, 0.0, 1.0));
  float density = remap(baseDensity, erosion * u_cloudDetailStrength * 0.4, 1.0, 0.0, 1.0);
  return clamp(density, 0.0, 1.0);
}
`;
