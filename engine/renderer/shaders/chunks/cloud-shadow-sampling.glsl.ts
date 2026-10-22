export const CLOUD_SHADOW_CHUNK = `
uniform sampler2D u_cloudShadowMap;

uniform vec4 u_cloudShadowRegion;
uniform float u_cloudShadowEnabled;

float cloudShadow(vec3 worldPos, vec3 L) {
  if (u_cloudShadowEnabled < 0.5) return 1.0;
  float t = (u_cloudShadowRegion.w - worldPos.y) / max(L.y, 0.05);
  vec2 hit = worldPos.xz + L.xz * t;
  vec2 uv = (hit - u_cloudShadowRegion.xy) * u_cloudShadowRegion.z + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
  return texture(u_cloudShadowMap, uv).r;
}
`;
