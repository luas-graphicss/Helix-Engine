import { SCENE_LIGHTING_CHUNK } from './chunks/scene-lighting.glsl';
export const MESH_VERTEX_SHADER = `#version 300 es
precision highp float;

invariant gl_Position;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in mat4 a_model;
layout(location = 7) in vec3 a_normalMatrix0;
layout(location = 8) in vec3 a_normalMatrix1;
layout(location = 9) in vec3 a_normalMatrix2;

layout(location = 10) in vec4 a_baseColorOpacity;

layout(location = 11) in vec4 a_surface;

layout(location = 12) in vec4 a_emissiveCutoff;

layout(location = 13) in vec4 a_mapParams;

uniform mat4 u_viewProjection;

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

out vec3 v_worldPosition;
out vec3 v_worldNormal;
out vec2 v_uv;
flat out vec4 v_baseColorOpacity;
flat out vec4 v_surface;
flat out vec4 v_emissiveCutoff;
flat out vec4 v_mapParams;

void main() {
#ifdef SKINNED

  mat4 skin = a_weights.x * jointMatrix(a_joints.x) + a_weights.y * jointMatrix(a_joints.y)
    + a_weights.z * jointMatrix(a_joints.z) + a_weights.w * jointMatrix(a_joints.w);
  vec4 worldPosition = skin * vec4(a_position, 1.0);
  v_worldNormal = normalize(mat3(skin) * a_normal);
#else
  vec4 worldPosition = a_model * vec4(a_position, 1.0);
  v_worldNormal = mat3(a_normalMatrix0, a_normalMatrix1, a_normalMatrix2) * a_normal;
#endif
  v_worldPosition = worldPosition.xyz;

  v_uv = a_uv * a_mapParams.w;
  v_baseColorOpacity = a_baseColorOpacity;
  v_surface = a_surface;
  v_emissiveCutoff = a_emissiveCutoff;
  v_mapParams = a_mapParams;
  gl_Position = u_viewProjection * worldPosition;
}
`;
export const MESH_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec2 v_uv;
flat in vec4 v_baseColorOpacity;
flat in vec4 v_surface;
flat in vec4 v_emissiveCutoff;
flat in vec4 v_mapParams;


uniform float u_alphaMode;
uniform sampler2D u_baseColorMap;
uniform sampler2D u_metallicRoughnessMap;
uniform sampler2D u_normalMap;
uniform sampler2D u_occlusionMap;
uniform sampler2D u_emissiveMap;

uniform int u_textureMask;

${SCENE_LIGHTING_CHUNK}

const int MAP_BASE_COLOR = 1;
const int MAP_METALLIC_ROUGHNESS = 2;
const int MAP_NORMAL = 4;
const int MAP_OCCLUSION = 8;
const int MAP_EMISSIVE = 16;

bool hasMap(int bit) {
  return (u_textureMask & bit) != 0;
}


vec3 perturbNormal(vec3 N, vec3 dp1, vec3 dp2, vec2 duv1, vec2 duv2, float normalScale) {
  vec3 mapN = texture(u_normalMap, v_uv).xyz * 2.0 - 1.0;
  mapN.xy *= vec2(normalScale, -normalScale);
  vec3 dp2perp = cross(dp2, N);
  vec3 dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float det = max(dot(T, T), dot(B, B));
  if (det <= 0.0) return N;
  float scale = inversesqrt(det);
  return normalize(T * (mapN.x * scale) + B * (mapN.y * scale) + N * mapN.z);
}

out vec4 fragColor;

void main() {

  vec3 positionDx = dFdx(v_worldPosition);
  vec3 positionDy = dFdy(v_worldPosition);
  vec2 uvDx = dFdx(v_uv);
  vec2 uvDy = dFdy(v_uv);

  vec3 baseColor = v_baseColorOpacity.rgb;
  float alpha = v_baseColorOpacity.a;
  if (hasMap(MAP_BASE_COLOR)) {
    vec4 baseSample = texture(u_baseColorMap, v_uv);
    baseColor *= baseSample.rgb;
    alpha *= baseSample.a;
  }
  if (u_alphaMode > 0.5 && u_alphaMode < 1.5 && alpha < v_emissiveCutoff.a) discard;

  float roughness = v_surface.x;
  float metallic = v_surface.y;
  if (hasMap(MAP_METALLIC_ROUGHNESS)) {
    vec4 metallicRoughness = texture(u_metallicRoughnessMap, v_uv);
    roughness *= metallicRoughness.g;
    metallic *= metallicRoughness.b;
  }

  vec3 N = normalize(v_worldNormal);
  if (!gl_FrontFacing) N = -N;
  if (hasMap(MAP_NORMAL)) N = perturbNormal(N, positionDx, positionDy, uvDx, uvDy, v_mapParams.x);

  float occlusion = 1.0;
  if (hasMap(MAP_OCCLUSION)) occlusion = 1.0 + v_mapParams.y * (texture(u_occlusionMap, v_uv).r - 1.0);

  vec3 emissive = v_emissiveCutoff.rgb * v_surface.z;
  if (hasMap(MAP_EMISSIVE)) emissive *= texture(u_emissiveMap, v_uv).rgb;

  Surface s = makeSurface(N, v_worldPosition, baseColor, roughness, metallic);
  vec3 hdr = shadeSurface(s, v_worldPosition, positionDx, positionDy, occlusion, emissive, v_surface.w);
  fragColor = vec4(finishSurfaceColor(hdr, s, v_mapParams.z), u_alphaMode > 1.5 ? alpha : 1.0);
}
`;
