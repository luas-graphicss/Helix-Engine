import { MESH_VARYINGS_IN } from './chunks/mesh-varyings.glsl';
export const DEPTH_ONLY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

void main() {}
`;
export const DEPTH_MASKED_FRAGMENT_SHADER = `#version 300 es
precision highp float;

${MESH_VARYINGS_IN}

uniform sampler2D u_baseColorMap;
                                         
uniform int u_textureMask;

void main() {
  float alpha = meshOpacity();
  if ((u_textureMask & 1) != 0) alpha *= texture(u_baseColorMap, v_uv).a;
  if (alpha < meshAlphaCutoff()) discard;
}
`;
