export const GIZMO_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;

uniform mat4 u_viewProjection;
uniform mat4 u_model;

out vec3 v_worldPosition;
out vec3 v_worldNormal;

void main() {
  vec4 worldPosition = u_model * vec4(a_position, 1.0);
  v_worldPosition = worldPosition.xyz;
  v_worldNormal = mat3(u_model) * a_normal;
  gl_Position = u_viewProjection * worldPosition;
}
`;
export const GIZMO_FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform vec3 u_color;
uniform float u_alpha;
uniform vec3 u_cameraPosition;
uniform vec3 u_origin;
 
uniform float u_dimBack;

in vec3 v_worldPosition;
in vec3 v_worldNormal;

out vec4 fragColor;

void main() {
  vec3 viewDirection = normalize(u_cameraPosition - v_worldPosition);
  float shade = 0.74 + 0.26 * abs(dot(normalize(v_worldNormal), viewDirection));

  vec3 toCamera = normalize(u_cameraPosition - u_origin);
  float behind = step(dot(v_worldPosition - u_origin, toCamera), 0.0);
  float alpha = u_alpha * mix(1.0, 0.22, behind * u_dimBack);

  fragColor = vec4(u_color * shade, alpha);
}
`;
