import { MYRIAD_POOL_CHUNK } from './myriad-pool.glsl';
export const MYRIAD_RASTER_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in uvec4 a_entry;
layout(location = 1) in vec4 a_world0;
layout(location = 2) in vec4 a_world1;
layout(location = 3) in vec4 a_world2;
layout(location = 4) in vec4 a_world3;

uniform mat4 u_viewProjection;
uniform highp sampler2D u_cullFlags;
 
uniform int u_cullMode;
 
uniform int u_slotBase;
 
uniform uint u_passBits;

${MYRIAD_POOL_CHUNK}

#ifndef DEPTH_ONLY
flat out uvec2 v_ids;
#endif

const vec4 CULLED = vec4(0.0, 0.0, 2.0, 1.0);

void main() {
  int slot = u_slotBase + gl_InstanceID;
  uint triangle = uint(gl_VertexID) / 3u;
  vec4 position = CULLED;
  if (u_cullMode == 0 || texelFetch(u_cullFlags, texelCoord(uint(slot)), 0).r > 0.5) {
    uint cluster = a_entry.x;
    uvec4 info = loadClusterInfo(cluster);
    if (triangle < (info.y & 0xffffu)) {
      uint corner = uint(gl_VertexID) - triangle * 3u;
      uvec3 tri = loadTriangle(cluster, triangle);
      uint local = corner == 0u ? tri.x : (corner == 1u ? tri.y : tri.z);
      ClusterBox box = loadClusterBox(cluster);
      PoolVertex v = loadVertex(info.x + local, box);
      mat4 world = mat4(a_world0, a_world1, a_world2, a_world3);
      position = u_viewProjection * (world * vec4(v.position, 1.0));
    }
  }
  gl_Position = position;
#ifndef DEPTH_ONLY
  v_ids = uvec2((uint(slot) + 1u) | (triangle << 25u), a_entry.z | u_passBits);
#endif
}
`;
export const MYRIAD_RASTER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

flat in uvec2 v_ids;

layout(location = 0) out uvec2 fragIds;

void main() {
  fragIds = v_ids;
}
`;
export const MYRIAD_DEPTH_FRAGMENT_SHADER = `#version 300 es
precision highp float;

void main() {}
`;
