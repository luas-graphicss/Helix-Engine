export const DEPTH_ONLY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

void main() {}
`;
export const DEPTH_MASKED_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
flat in vec4 v_baseColorOpacity;
flat in vec4 v_emissiveCutoff;

uniform sampler2D u_baseColorMap;

uniform int u_textureMask;

void main() {
  float alpha = v_baseColorOpacity.a;
  if ((u_textureMask & 1) != 0) alpha *= texture(u_baseColorMap, v_uv).a;
  if (alpha < v_emissiveCutoff.a) discard;
}
`;
