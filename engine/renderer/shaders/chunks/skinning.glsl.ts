export const SKINNING_CHUNK = `
layout(location = 14) in uvec4 a_skin;
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

                                                                                                                    
mat4 skinMatrix() {
  uvec4 joints = a_skin >> 16u;
  vec4 weights = vec4(a_skin & 0xFFFFu) * (1.0 / 65535.0);
  return weights.x * jointMatrix(joints.x) + weights.y * jointMatrix(joints.y)
    + weights.z * jointMatrix(joints.z) + weights.w * jointMatrix(joints.w);
}
`;
