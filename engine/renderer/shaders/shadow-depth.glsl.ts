export const SHADOW_DEPTH_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 3) in mat4 a_model;

uniform mat4 u_lightViewProjection;

void main() {
  gl_Position = u_lightViewProjection * a_model * vec4(a_position, 1.0);
}
`;
export const SHADOW_DEPTH_FRAGMENT_SHADER = `#version 300 es
precision highp float;

void main() {}
`;
