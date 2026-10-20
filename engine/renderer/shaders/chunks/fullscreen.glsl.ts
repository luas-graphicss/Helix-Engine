export const FULLSCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.999999, 1.0);
}
`;
export const FULLSCREEN_RAY_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;

uniform mat4 u_inverseViewProjection;

out vec3 v_nearPoint;
out vec3 v_farPoint;

vec3 unproject(vec2 ndc, float depth) {
  vec4 point = u_inverseViewProjection * vec4(ndc, depth, 1.0);
  return point.xyz / point.w;
}

void main() {
  v_nearPoint = unproject(a_position, -1.0);
  v_farPoint = unproject(a_position, 1.0);
  gl_Position = vec4(a_position, 0.999999, 1.0);
}
`;
