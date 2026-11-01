export const DEBUG_VIEW_CHUNK = `
const int DEBUG_VIEW_NONE = 0;
const int DEBUG_VIEW_CLUSTERS = 1;
const int DEBUG_VIEW_GROUPS = 2;
const int DEBUG_VIEW_LEVELS = 3;
const int DEBUG_VIEW_TRIANGLES = 4;
const int DEBUG_VIEW_NORMALS = 5;
const int DEBUG_VIEW_OCCLUSION = 6;

                                                                                                   
vec3 hashColor(uint id) {
  uint h = id * 747796405u + 2891336453u;
  h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u;
  h = (h >> 22u) ^ h;
  return vec3(float(h & 0xffu), float((h >> 8u) & 0xffu), float((h >> 16u) & 0xffu)) * (0.7 / 255.0) + 0.25;
}

                                                                                                             
const vec3 LEVEL_PALETTE[8] = vec3[8](
  vec3(0.18, 0.42, 0.85),
  vec3(0.20, 0.72, 0.78),
  vec3(0.26, 0.74, 0.36),
  vec3(0.76, 0.80, 0.22),
  vec3(0.95, 0.62, 0.18),
  vec3(0.92, 0.33, 0.22),
  vec3(0.80, 0.26, 0.60),
  vec3(0.55, 0.36, 0.90)
);

   
                                                                           
                                                                              
                                                                     
   
const vec3 CLASSIC_MESH_DEBUG_COLOR = vec3(0.3);

                                                                                          
vec3 shadeDebugColor(vec3 color, vec3 N, vec3 sunDirection) {
  return color * (0.55 + 0.45 * max(dot(N, sunDirection), 0.0));
}

                                                                           
vec3 normalDebugColor(vec3 N) {
  return N * 0.5 + 0.5;
}
`;
