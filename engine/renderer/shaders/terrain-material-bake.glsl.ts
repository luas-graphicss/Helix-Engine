import { TERRAIN_MATERIAL_CHUNK } from './chunks/terrain-material.glsl';
import { OCTAHEDRAL_CHUNK } from './chunks/octahedral.glsl';
export const TERRAIN_MATERIAL_BAKE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2DArray;

${TERRAIN_MATERIAL_CHUNK}
${OCTAHEDRAL_CHUNK}

uniform highp sampler2D u_heightMap;
uniform float u_halfSize;
uniform float u_cellSize;

uniform int u_lastSample;

uniform vec4 u_tile;

uniform float u_texelSize;

uniform float u_far;

layout(location = 0) out vec4 outAlbedoRoughness;
layout(location = 1) out vec4 outNormalOcclusion;

float heightAt(ivec2 grid) {
  return texelFetch(u_heightMap, clamp(grid, ivec2(0), ivec2(u_lastSample)), 0).r;
}


vec3 vertexNormal(ivec2 grid) {
  float left = heightAt(grid + ivec2(-1, 0));
  float right = heightAt(grid + ivec2(1, 0));
  float up = heightAt(grid + ivec2(0, -1));
  float down = heightAt(grid + ivec2(0, 1));
  return normalize(vec3(left - right, 2.0 * u_cellSize, up - down));
}

void main() {
  vec2 xz = u_tile.xy + (gl_FragCoord.xy - u_tile.zw) * u_texelSize;
  float last = float(u_lastSample);
  vec2 grid = clamp((xz + u_halfSize) / u_cellSize, 0.0, last);
  ivec2 cell = ivec2(min(floor(grid), last - 1.0));
  vec2 t = grid - vec2(cell);
  ivec2 cellX = cell + ivec2(1, 0);
  ivec2 cellZ = cell + ivec2(0, 1);
  ivec2 cellXZ = cell + ivec2(1, 1);

  float height = mix(mix(heightAt(cell), heightAt(cellX), t.x), mix(heightAt(cellZ), heightAt(cellXZ), t.x), t.y);
  vec3 Ng = normalize(mix(mix(vertexNormal(cell), vertexNormal(cellX), t.x), mix(vertexNormal(cellZ), vertexNormal(cellXZ), t.x), t.y));


  float invY = 1.0 / max(Ng.y, 0.05);
  vec3 dx = vec3(1.0, -Ng.x * invY, 0.0) * u_texelSize;
  vec3 dy = vec3(0.0, -Ng.z * invY, 1.0) * u_texelSize;
  Footprint f = terrainFootprint(vec3(xz.x, height, xz.y), dx, dy, Ng, u_far);
  vec2 uv = (xz + u_halfSize) / (2.0 * u_halfSize);

  TerrainMaterial m = evaluateTerrainMaterial(f, Ng, uv);
  outAlbedoRoughness = vec4(m.albedo, m.roughness);
  outNormalOcclusion = vec4(octEncode(m.normal) * 0.5 + 0.5, m.occlusion, 1.0);
}
`;
