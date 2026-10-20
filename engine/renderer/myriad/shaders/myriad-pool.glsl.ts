import { CLUSTER_MAX_TRIANGLES, INSTANCE_TEXELS } from '../data/myriad-limits';
export const MYRIAD_POOL_CHUNK = `
uniform highp usampler2D u_vertices;
uniform highp usampler2D u_triangles;
uniform highp usampler2D u_clusterInfo;
uniform highp sampler2D u_clusterBounds;

const uint MYRIAD_WIDTH_MASK = (1u << uint(MYRIAD_WIDTH_SHIFT)) - 1u;
const uint TRIANGLES_PER_CLUSTER = ${CLUSTER_MAX_TRIANGLES}u;
const int INSTANCE_TEXELS = ${INSTANCE_TEXELS};

ivec2 texelCoord(uint index) {
  return ivec2(int(index & MYRIAD_WIDTH_MASK), int(index >> uint(MYRIAD_WIDTH_SHIFT)));
}

 
struct ClusterBox {
  vec3 min;
  vec3 extent;
  float error;
  float parentError;
};

ClusterBox loadClusterBox(uint cluster) {
  vec4 a = texelFetch(u_clusterBounds, texelCoord(cluster * 2u), 0);
  vec4 b = texelFetch(u_clusterBounds, texelCoord(cluster * 2u + 1u), 0);
  return ClusterBox(a.xyz, b.xyz, a.w, b.w);
}

 
uvec4 loadClusterInfo(uint cluster) {
  return texelFetch(u_clusterInfo, texelCoord(cluster), 0);
}

uvec3 loadTriangle(uint cluster, uint triangle) {
  return texelFetch(u_triangles, texelCoord(cluster * TRIANGLES_PER_CLUSTER + triangle), 0).xyz;
}

vec2 decodeSnorm2(uint packed) {
  int x = int(packed & 0xffffu);
  int y = int(packed >> 16u);
  x -= (x >> 15) * 65536;
  y -= (y >> 15) * 65536;
  return vec2(float(x), float(y)) * (1.0 / 32767.0);
}

vec3 octDecode(vec2 f) {
  vec3 n = vec3(f, 1.0 - abs(f.x) - abs(f.y));
  float t = max(-n.z, 0.0);
  n.x += n.x >= 0.0 ? -t : t;
  n.y += n.y >= 0.0 ? -t : t;
  return normalize(n);
}

struct PoolVertex {
  vec3 position;
  vec3 normal;
  vec2 uv;
};

PoolVertex loadVertex(uint index, ClusterBox box) {
  uvec4 v = texelFetch(u_vertices, texelCoord(index), 0);
  PoolVertex r;
  vec3 quantized = vec3(float(v.x & 0xffffu), float(v.x >> 16u), float(v.y & 0xffffu));
  r.position = box.min + box.extent * (quantized * (1.0 / 65535.0));
  r.normal = octDecode(decodeSnorm2(v.z));
  r.uv = unpackHalf2x16(v.w);
  return r;
}
`;
export const MYRIAD_INSTANCE_CHUNK = `
vec4 instanceTexel(int instance, int texel) {
  return texelFetch(u_instances, texelCoord(uint(instance * INSTANCE_TEXELS + texel)), 0);
}

mat4 instanceMatrix(int instance, int firstTexel) {
  return mat4(instanceTexel(instance, firstTexel), instanceTexel(instance, firstTexel + 1), instanceTexel(instance, firstTexel + 2), instanceTexel(instance, firstTexel + 3));
}
`;
