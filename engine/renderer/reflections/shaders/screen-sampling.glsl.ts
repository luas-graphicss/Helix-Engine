export const SCREEN_SAMPLING_CHUNK = `
float viewZFromDepth(float depth) {
  float ndcZ = depth * 2.0 - 1.0;
  return -u_projection[3][2] / (ndcZ + u_projection[2][2]);
}

float screenEdgeFade(vec2 uv) {
  vec2 fade = smoothstep(vec2(0.0), vec2(0.08), uv) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - uv);
  return fade.x * fade.y;
}

float skyDirectionUv(vec3 viewDirection, out vec2 uv) {
  vec4 clip = u_projection * vec4(viewDirection, 0.0);
  uv = vec2(0.0);
  if (clip.w <= 1e-4) return 0.0;
  uv = clip.xy / clip.w * 0.5 + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  float depth = texelFetch(u_sceneDepth, clamp(ivec2(uv * u_sceneSize), ivec2(0), ivec2(u_sceneSize) - 1), 0).r;
  if (depth < 1.0) return 0.0;
  return screenEdgeFade(uv);
}
`;
