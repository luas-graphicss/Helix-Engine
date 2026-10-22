import { BRDF_CHUNK } from '@/engine/renderer/shaders/chunks/brdf.glsl';
export const PREVIEW_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;

uniform mat4 u_model;
uniform mat4 u_viewProjection;
uniform mat3 u_normalMatrix;
uniform float u_uvTiling;

out vec3 v_worldPosition;
out vec3 v_worldNormal;
out vec2 v_uv;

void main() {
  vec4 worldPosition = u_model * vec4(a_position, 1.0);
  v_worldPosition = worldPosition.xyz;
  v_worldNormal = u_normalMatrix * a_normal;
  v_uv = a_uv * u_uvTiling;
  gl_Position = u_viewProjection * worldPosition;
}
`;
export const PREVIEW_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec2 v_uv;

uniform vec3 u_cameraPosition;
uniform vec4 u_baseColorOpacity;
uniform vec2 u_roughnessMetallic;
uniform vec3 u_emissive;
uniform float u_emissiveIntensity;
uniform float u_normalScale;
uniform float u_occlusionStrength;
uniform float u_alphaCutoff;

uniform float u_alphaMode;
uniform int u_textureMask;
uniform sampler2D u_baseColorMap;
uniform sampler2D u_metallicRoughnessMap;
uniform sampler2D u_normalMap;
uniform sampler2D u_occlusionMap;
uniform sampler2D u_emissiveMap;

uniform vec3 u_lightDirections[3];
uniform vec3 u_lightColors[3];
uniform vec3 u_skyColor;
uniform vec3 u_groundColor;
uniform float u_exposure;

${BRDF_CHUNK}

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


vec3 environmentColor(vec3 R, float roughness) {
  vec3 gradient = mix(u_groundColor, u_skyColor, smoothstep(-0.35, 0.65, R.y));
  float window = pow(max(dot(R, u_lightDirections[0]), 0.0), mix(48.0, 2.0, roughness));
  return gradient + u_lightColors[0] * window * mix(0.35, 0.08, roughness);
}

vec3 tonemapAces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

out vec4 fragColor;

void main() {
  vec3 positionDx = dFdx(v_worldPosition);
  vec3 positionDy = dFdy(v_worldPosition);
  vec2 uvDx = dFdx(v_uv);
  vec2 uvDy = dFdy(v_uv);

  vec3 baseColor = u_baseColorOpacity.rgb;
  float alpha = u_baseColorOpacity.a;
  if (hasMap(MAP_BASE_COLOR)) {
    vec4 baseSample = texture(u_baseColorMap, v_uv);
    baseColor *= baseSample.rgb;
    alpha *= baseSample.a;
  }
  if (u_alphaMode > 0.5 && u_alphaMode < 1.5 && alpha < u_alphaCutoff) discard;

  float roughness = u_roughnessMetallic.x;
  float metallic = u_roughnessMetallic.y;
  if (hasMap(MAP_METALLIC_ROUGHNESS)) {
    vec4 packed = texture(u_metallicRoughnessMap, v_uv);
    roughness *= packed.g;
    metallic *= packed.b;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  vec3 N = normalize(v_worldNormal);
  if (!gl_FrontFacing) N = -N;
  if (hasMap(MAP_NORMAL)) N = perturbNormal(N, positionDx, positionDy, uvDx, uvDy, u_normalScale);

  float occlusion = 1.0;
  if (hasMap(MAP_OCCLUSION)) occlusion = 1.0 + u_occlusionStrength * (texture(u_occlusionMap, v_uv).r - 1.0);

  vec3 emissive = u_emissive * u_emissiveIntensity;
  if (hasMap(MAP_EMISSIVE)) emissive *= texture(u_emissiveMap, v_uv).rgb;

  vec3 V = normalize(u_cameraPosition - v_worldPosition);
  float NdotV = max(dot(N, V), 1e-4);
  vec3 f0 = mix(vec3(0.04), baseColor, metallic);
  vec3 diffuseColor = baseColor * (1.0 - metallic);
  float alphaRoughness = roughness * roughness;

  vec3 color = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 L = u_lightDirections[i];
    float NdotL = max(dot(N, L), 0.0);
    if (NdotL <= 0.0) continue;
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);
    vec3 F = fresnelSchlick(VdotH, f0);
    float D = distributionGgx(NdotH, alphaRoughness);
    float Vis = visibilitySmithGgxCorrelated(NdotV, NdotL, alphaRoughness);
    vec3 specular = F * D * Vis;
    vec3 diffuse = (1.0 - F) * diffuseColor / PI;
    color += (diffuse + specular) * u_lightColors[i] * NdotL;
  }

  vec3 ambientDiffuse = mix(u_groundColor, u_skyColor, N.y * 0.5 + 0.5) * diffuseColor;
  vec3 R = reflect(-V, N);
  vec3 ambientSpecular = environmentColor(R, roughness) * environmentBrdf(f0, roughness, NdotV);
  color += (ambientDiffuse + ambientSpecular) * occlusion;
  color += emissive;

  vec3 mapped = linearToSrgb(tonemapAces(color * u_exposure));
  float outAlpha = u_alphaMode > 1.5 ? alpha : 1.0;
  fragColor = vec4(mapped * outAlpha, outAlpha);
}
`;
