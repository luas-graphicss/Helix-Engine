import { MYRIAD_INSTANCE_CHUNK, MYRIAD_POOL_CHUNK } from './myriad-pool.glsl';
export const MYRIAD_CULL_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform highp usampler2D u_list;
uniform highp sampler2D u_instances;
uniform highp sampler2D u_hzb;
uniform highp sampler2D u_previousFlags;
uniform mat4 u_viewProjection;
uniform int u_entryCount;
 
uniform int u_useHistory;
 
uniform int u_postPass;
uniform vec2 u_hzbSize;
uniform int u_hzbMaxLevel;

${MYRIAD_POOL_CHUNK}
${MYRIAD_INSTANCE_CHUNK}

out vec4 fragFlag;

float occluderDepth(ivec2 coord, int level) {
  return texelFetch(u_hzb, coord, level).r;
}

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  int slot = px.y * int(MYRIAD_WIDTH_MASK + 1u) + px.x;
  if (slot >= u_entryCount) {
    fragFlag = vec4(0.0);
    return;
  }
  if (u_postPass == 1 && texelFetch(u_previousFlags, px, 0).r > 0.5) {
    fragFlag = vec4(0.0);
    return;
  }

  uvec4 entry = texelFetch(u_list, px, 0);
  ClusterBox box = loadClusterBox(entry.x);
  mat4 mvp = u_viewProjection * instanceMatrix(int(entry.y), u_useHistory == 1 ? 4 : 0);

  vec2 rectMin = vec2(1e30);
  vec2 rectMax = vec2(-1e30);
  float nearest = 1e30;
  for (int i = 0; i < 8; i++) {
    vec3 corner = box.min + box.extent * vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    vec4 clip = mvp * vec4(corner, 1.0);
    if (clip.w <= 1e-6) {
       
      fragFlag = vec4(1.0);
      return;
    }
    vec3 ndc = clip.xyz / clip.w;
    rectMin = min(rectMin, ndc.xy);
    rectMax = max(rectMax, ndc.xy);
    nearest = min(nearest, ndc.z);
  }
  if (rectMax.x < -1.0 || rectMin.x > 1.0 || rectMax.y < -1.0 || rectMin.y > 1.0 || nearest > 1.0) {
     
    fragFlag = vec4(u_postPass == 1 ? 0.0 : 1.0);
    return;
  }

  float depthMin = nearest * 0.5 + 0.5;
  vec2 pxMin = clamp(rectMin * 0.5 + 0.5, 0.0, 1.0) * u_hzbSize;
  vec2 pxMax = clamp(rectMax * 0.5 + 0.5, 0.0, 1.0) * u_hzbSize;
  float size = max(max(pxMax.x - pxMin.x, pxMax.y - pxMin.y), 1.0);
  int level = int(ceil(log2(size)));
  ivec2 first = ivec2(floor(pxMin));
  ivec2 last = ivec2(max(ceil(pxMax) - 1.0, 0.0));
  ivec2 tMin = first >> level;
  ivec2 tMax = last >> level;
  if (tMax.x - tMin.x > 1 || tMax.y - tMin.y > 1) {
    level++;
    tMin = first >> level;
    tMax = last >> level;
  }
  level = min(level, u_hzbMaxLevel);
  ivec2 levelSize = max(ivec2(u_hzbSize) >> level, ivec2(1));
  tMin = clamp(tMin, ivec2(0), levelSize - 1);
  tMax = clamp(tMax, ivec2(0), levelSize - 1);

  float occluder = max(
    max(occluderDepth(tMin, level), occluderDepth(ivec2(tMax.x, tMin.y), level)),
    max(occluderDepth(ivec2(tMin.x, tMax.y), level), occluderDepth(tMax, level))
  );
  fragFlag = vec4(depthMin <= occluder ? 1.0 : 0.0);
}
`;
