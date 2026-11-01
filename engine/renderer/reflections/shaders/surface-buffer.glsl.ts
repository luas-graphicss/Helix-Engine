import { MESH_VARYINGS_IN } from '@/engine/renderer/shaders/chunks/mesh-varyings.glsl';
import { OCTAHEDRAL_CHUNK } from '@/engine/renderer/shaders/chunks/octahedral.glsl';
export const SURFACE_BUFFER_ENCODING_CHUNK = `
${OCTAHEDRAL_CHUNK}

vec4 encodeSurfaceBuffer(vec3 N, float roughness) {
  return vec4(octEncode(N) * 0.5 + 0.5, clamp(roughness, 0.0, 1.0), 1.0);
}

struct SurfaceSample {
  vec3 N;
  float roughness;
  bool valid;
};

SurfaceSample decodeSurfaceBuffer(vec4 texel) {
  SurfaceSample s;
  s.valid = texel.a > 0.5;
  s.N = octDecode(texel.rg * 2.0 - 1.0);
  s.roughness = texel.b;
  return s;
}
`;
export const MESH_SURFACE_PREPASS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

${MESH_VARYINGS_IN}

uniform sampler2D u_baseColorMap;
uniform sampler2D u_metallicRoughnessMap;
                                                                                 
uniform int u_textureMask;

${SURFACE_BUFFER_ENCODING_CHUNK}

layout(location = 0) out vec4 fragSurface;

void main() {
#ifdef MASKED
  float alpha = meshOpacity();
  if ((u_textureMask & 1) != 0) alpha *= texture(u_baseColorMap, v_uv).a;
  if (alpha < meshAlphaCutoff()) discard;
#endif
  float roughness = meshRoughnessMetallic().x;
  if ((u_textureMask & 2) != 0) roughness *= texture(u_metallicRoughnessMap, v_uv).g;
  vec3 N = normalize(v_worldNormal.xyz);
  if (!gl_FrontFacing) N = -N;
  fragSurface = encodeSurfaceBuffer(N, roughness);
}
`;
export const TERRAIN_SURFACE_PREPASS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_localNormal;

uniform mat3 u_normalMatrix;

${SURFACE_BUFFER_ENCODING_CHUNK}

const float TERRAIN_PREPASS_ROUGHNESS = 0.85;

layout(location = 0) out vec4 fragSurface;

void main() {
  vec3 N = normalize(u_normalMatrix * v_localNormal);
  if (!gl_FrontFacing) N = -N;
  fragSurface = encodeSurfaceBuffer(N, TERRAIN_PREPASS_ROUGHNESS);
}
`;
