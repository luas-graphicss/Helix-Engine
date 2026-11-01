export const LINE_HELPER_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec4 a_color;

uniform mat4 u_viewProjection;

out vec4 v_color;

void main() {
  v_color = a_color;
  gl_Position = u_viewProjection * vec4(a_position, 1.0);
}
`;
export const LINE_HELPER_FRAGMENT_SHADER = `#version 300 es
precision mediump float;

                                                                                                   
uniform float u_alphaScale;

in vec4 v_color;

out vec4 fragColor;

void main() {
  fragColor = vec4(v_color.rgb, v_color.a * u_alphaScale);
}
`;
