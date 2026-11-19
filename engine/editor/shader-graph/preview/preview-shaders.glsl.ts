import { POST_SHADER_HELPERS, POST_SHADER_VARYINGS, standardUniformLines, SURFACE_SHADER_ALIASES, SURFACE_SHADER_STRUCT } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
const FRAGMENT_HEADER = `#version 300 es
precision highp float;
precision highp int;`;
export const SURFACE_PREVIEW_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
uniform mat4 u_previewViewProjection;
out vec3 v_worldPosition;
out vec3 v_normal;
out vec2 v_uv;
void main() {
  v_worldPosition = a_position;
  v_normal = a_normal;
  v_uv = a_uv;
  gl_Position = u_previewViewProjection * vec4(a_position, 1.0);
}
`;
const SURFACE_PREVIEW_INPUTS = `uniform vec3 u_cameraPosition;
uniform vec3 u_sunDirection;
uniform vec3 u_sunRadiance;
in vec3 v_worldPosition;
in vec3 v_normal;
in vec2 v_uv;
out vec4 fragColor;`;
const SURFACE_PREVIEW_MAIN = `vec3 previewAmbient(vec3 direction) {
  return mix(vec3(0.07, 0.065, 0.06), vec3(0.32, 0.38, 0.48), direction.y * 0.5 + 0.5);
}
void main() {
  HelixSurface s;
  s.baseColor = vec3(0.8);
  s.alpha = 1.0;
  s.roughness = 0.5;
  s.metallic = 0.0;
  s.normal = normalize(gl_FrontFacing ? v_normal : -v_normal);
  s.occlusion = 1.0;
  s.emissive = vec3(0.0);
  s.worldPosition = v_worldPosition;
  s.uv = v_uv;
  s.viewDirection = normalize(u_cameraPosition - v_worldPosition);
  s.frontFacing = gl_FrontFacing;
  surface(s);
  vec3 normal = normalize(s.normal);
  vec3 view = s.viewDirection;
  vec3 halfway = normalize(u_sunDirection + view);
  float roughness = clamp(s.roughness, 0.045, 1.0);
  float metallic = clamp(s.metallic, 0.0, 1.0);
  float facingLight = max(dot(normal, u_sunDirection), 0.0);
  float facingView = max(dot(normal, view), 0.001);
  float facingHalfway = max(dot(normal, halfway), 0.0);
  float spread = roughness * roughness * roughness * roughness;
  float lobe = facingHalfway * facingHalfway * (spread - 1.0) + 1.0;
  float distribution = spread / (3.14159265 * lobe * lobe);
  float remap = (roughness + 1.0) * (roughness + 1.0) / 8.0;
  float visibility = (facingLight / (facingLight * (1.0 - remap) + remap)) * (facingView / (facingView * (1.0 - remap) + remap));
  vec3 reflectance = mix(vec3(0.04), s.baseColor, metallic);
  vec3 fresnel = reflectance + (1.0 - reflectance) * pow(1.0 - max(dot(halfway, view), 0.0), 5.0);
  vec3 specular = fresnel * distribution * visibility / (4.0 * facingLight * facingView + 0.0001);
  vec3 diffuse = s.baseColor * (1.0 - metallic) * (1.0 - fresnel) / 3.14159265;
  vec3 color = (diffuse + specular) * u_sunRadiance * facingLight;
  vec3 grazing = reflectance + (max(vec3(1.0 - roughness), reflectance) - reflectance) * pow(1.0 - facingView, 5.0);
  vec3 ambient = previewAmbient(normal) * s.baseColor * (1.0 - metallic) + previewAmbient(reflect(-view, normal)) * grazing * (1.0 - roughness * 0.6);
  color += ambient * clamp(s.occlusion, 0.0, 1.0) + s.emissive;
  color = pow(color / (1.0 + color), vec3(1.0 / 2.2));
  float opacity = clamp(s.alpha, 0.0, 1.0);
  fragColor = vec4(color * opacity, opacity);
}
`;
export function surfacePreviewFragment(source: string): string {
    return [FRAGMENT_HEADER, standardUniformLines('surface'), SURFACE_PREVIEW_INPUTS, SURFACE_SHADER_ALIASES, SURFACE_SHADER_STRUCT, source, SURFACE_PREVIEW_MAIN].join('\n');
}
export function postPreviewFragment(source: string): string {
    return [FRAGMENT_HEADER, standardUniformLines('post'), POST_SHADER_VARYINGS, POST_SHADER_HELPERS, source].join('\n');
}
