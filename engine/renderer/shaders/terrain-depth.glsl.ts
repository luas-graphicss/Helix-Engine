import { TERRAIN_VERTEX_CHUNK } from './chunks/terrain-vertex.glsl';
export const TERRAIN_DEPTH_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${TERRAIN_VERTEX_CHUNK}

uniform mat4 u_lightViewProjection;
uniform mat4 u_model;

void main() {
  ivec2 grid = terrainGrid();
  gl_Position = u_lightViewProjection * u_model * vec4(terrainLocalPosition(grid, terrainHeight(grid)), 1.0);
}
`;
