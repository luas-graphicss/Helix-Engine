import type { GlslChunk } from '../node-definition';
export const PERTURB_NORMAL_CHUNK: GlslChunk = {
    name: 'sgPerturbNormal',
    source: `vec3 sgPerturbNormal(vec3 tangentNormal, vec3 surfaceNormal, vec3 position, vec2 uv, float strength) {
  vec3 positionDx = dFdx(position);
  vec3 positionDy = dFdy(position);
  vec2 uvDx = dFdx(uv);
  vec2 uvDy = dFdy(uv);
  vec3 perpendicularX = cross(positionDy, surfaceNormal);
  vec3 perpendicularY = cross(surfaceNormal, positionDx);
  vec3 tangent = perpendicularX * uvDx.x + perpendicularY * uvDy.x;
  vec3 bitangent = perpendicularX * uvDx.y + perpendicularY * uvDy.y;
  float scale = inversesqrt(max(max(dot(tangent, tangent), dot(bitangent, bitangent)), 1e-12));
  vec3 mapped = vec3(tangentNormal.xy * strength, tangentNormal.z);
  return normalize(mat3(tangent * scale, bitangent * scale, surfaceNormal) * mapped);
}`,
};
export const HEIGHT_NORMAL_CHUNK: GlslChunk = {
    name: 'sgHeightNormal',
    source: `vec3 sgHeightNormal(float height, vec3 surfaceNormal, vec3 position, float strength) {
  vec3 positionDx = dFdx(position);
  vec3 positionDy = dFdy(position);
  vec3 perpendicularX = cross(positionDy, surfaceNormal);
  vec3 perpendicularY = cross(surfaceNormal, positionDx);
  float determinant = dot(positionDx, perpendicularX);
  vec3 gradient = sign(determinant) * (dFdx(height) * perpendicularX + dFdy(height) * perpendicularY) * strength;
  return normalize(abs(determinant) * surfaceNormal - gradient);
}`,
};
