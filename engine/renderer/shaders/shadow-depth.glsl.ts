export const SHADOW_DEPTH_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 3) in mat4 a_model;

uniform mat4 u_lightViewProjection;

#ifdef SKINNED
layout(location = 14) in uvec4 a_joints;
layout(location = 15) in vec4 a_weights;
uniform highp sampler2D u_jointMatrices;

mat4 jointMatrix(uint joint) {
  int row = int(joint);
  return mat4(
    texelFetch(u_jointMatrices, ivec2(0, row), 0),
    texelFetch(u_jointMatrices, ivec2(1, row), 0),
    texelFetch(u_jointMatrices, ivec2(2, row), 0),
    texelFetch(u_jointMatrices, ivec2(3, row), 0)
  );
}
#endif

void main() {
#ifdef SKINNED
  mat4 skin = a_weights.x * jointMatrix(a_joints.x) + a_weights.y * jointMatrix(a_joints.y)
    + a_weights.z * jointMatrix(a_joints.z) + a_weights.w * jointMatrix(a_joints.w);
  gl_Position = u_lightViewProjection * (skin * vec4(a_position, 1.0));
#else
  gl_Position = u_lightViewProjection * a_model * vec4(a_position, 1.0);
#endif
}
`;
export const SHADOW_DEPTH_FRAGMENT_SHADER = `#version 300 es
precision highp float;

void main() {}
`;
