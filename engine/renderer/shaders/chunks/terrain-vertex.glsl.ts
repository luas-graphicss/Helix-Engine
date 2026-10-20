import { ATTRIB_PATCH, ATTRIB_TILE_ORIGIN } from '@/engine/renderer/terrain/terrain-patch';
export const TERRAIN_VERTEX_CHUNK = `
layout(location = ${ATTRIB_PATCH}) in vec2 a_patch;
layout(location = ${ATTRIB_TILE_ORIGIN}) in vec2 a_tileOrigin;

uniform highp sampler2D u_heightMap;
uniform float u_halfSize;
uniform float u_cellSize;
 
uniform int u_lastSample;

float terrainHeight(ivec2 grid) {
  return texelFetch(u_heightMap, clamp(grid, ivec2(0), ivec2(u_lastSample)), 0).r;
}

 
ivec2 terrainGrid() {
  return min(ivec2(a_tileOrigin + a_patch + 0.5), ivec2(u_lastSample));
}

vec3 terrainLocalPosition(ivec2 grid, float height) {
  return vec3(float(grid.x) * u_cellSize - u_halfSize, height, float(grid.y) * u_cellSize - u_halfSize);
}
`;
