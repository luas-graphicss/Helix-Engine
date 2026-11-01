export const SCREEN_OCCLUSION_RADIUS_METERS = 1.0;
export const SCREEN_OCCLUSION_CHUNK = `
uniform highp sampler2D u_depth;
uniform mat4 u_inverseViewProjection;
                                                                                                                           
uniform vec2 u_screenOcclusion;

const int SCREEN_OCCLUSION_TAPS = 8;
const float SCREEN_OCCLUSION_MIN_PIXELS = 2.0;
const float SCREEN_OCCLUSION_MAX_PIXELS = 64.0;
                                                                                                                                                                                                   
const float SCREEN_OCCLUSION_BIAS = 0.05;
const vec2 SCREEN_OCCLUSION_OFFSETS[8] = vec2[8](
  vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
  vec2(0.3536, 0.3536), vec2(-0.3536, 0.3536), vec2(0.3536, -0.3536), vec2(-0.3536, -0.3536)
);

vec3 worldFromDepth(ivec2 px, float depth) {
  vec2 uv = (vec2(px) + 0.5) / vec2(textureSize(u_depth, 0));
  vec4 world = u_inverseViewProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return world.xyz / world.w;
}

   
                                                                                   
                                                                                 
                                 
   
float screenOcclusion(ivec2 px, ivec2 limit, vec3 P, vec3 N, float viewDistance) {
  float radiusPixels = clamp(u_screenOcclusion.y / max(viewDistance, 1e-3), SCREEN_OCCLUSION_MIN_PIXELS, SCREEN_OCCLUSION_MAX_PIXELS);
  float range2 = u_screenOcclusion.x * u_screenOcclusion.x;
  float sum = 0.0;
  for (int i = 0; i < SCREEN_OCCLUSION_TAPS; i++) {
    ivec2 tap = clamp(px + ivec2(round(SCREEN_OCCLUSION_OFFSETS[i] * radiusPixels)), ivec2(0), limit);
    float depth = texelFetch(u_depth, tap, 0).r;
                                       
    if (depth >= 1.0) continue;
    vec3 toSample = worldFromDepth(tap, depth) - P;
    float distance2 = max(dot(toSample, toSample), 1e-8);
    float elevation = max(dot(N, toSample) - SCREEN_OCCLUSION_BIAS * sqrt(distance2), 0.0);
    sum += (elevation * elevation / distance2) * (range2 / (range2 + distance2));
  }
  return sum / float(SCREEN_OCCLUSION_TAPS);
}
`;
