import { SCENE_LIGHTING_CHUNK } from './chunks/scene-lighting.glsl';
export const GRASS_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_blade;
 
layout(location = 1) in vec4 a_instance0;
 
layout(location = 2) in vec4 a_instance1;
 
layout(location = 3) in vec3 a_instance2;

uniform mat4 u_viewProjection;
uniform mat4 u_model;
uniform vec3 u_cameraPosition;
 
uniform vec4 u_blade;
 
uniform vec4 u_wind;

out vec3 v_worldPosition;
out vec3 v_worldNormal;
out vec3 v_layerColor;
out float v_t;
out float v_variation;

void main() {
  float side = a_blade.x;
  float t = a_blade.y;
  float yaw = a_instance0.w;
  float c = cos(yaw);
  float s = sin(yaw);
  vec2 forward = vec2(s, c);
  vec2 lateral = vec2(c, -s);
  vec3 root = (u_model * vec4(a_instance0.xyz, 1.0)).xyz;

  float dist = distance(root, u_cameraPosition);
  float fade = 1.0 - smoothstep(u_blade.z * 0.72, u_blade.z, dist);
  float height = u_blade.x * a_instance1.x * fade;
  float halfWidth = u_blade.y * 0.5 * u_blade.w * (1.0 - t * t) * step(0.001, height);

   
  float wave = sin(dot(root.xz, u_wind.xy) * 0.35 - u_wind.w * 1.7 + a_instance1.w) * 0.5 + 0.5;
  float flutter = sin(u_wind.w * 3.3 + a_instance1.w * 2.0) * 0.15;
  float sway = (0.25 + wave * 0.75 + flutter) * u_wind.z;

  vec2 lean = (forward * (a_instance1.y * 0.3) + u_wind.xy * (sway * 0.5)) * height * t * t;
  float drop = dot(lean, lean) * 0.5 / max(height, 1e-3);

  vec3 offset = vec3(lateral.x * side * halfWidth, t * height - drop, lateral.y * side * halfWidth);
  offset.xz += lean;
  vec3 world = root + offset;

   
  float tilt = length(lean) * 2.5 / max(height, 1e-3);
  vec3 normal = normalize(vec3(forward.x, 0.0, forward.y) * (1.0 - tilt * 0.5) + vec3(0.0, tilt, 0.0) + vec3(lateral.x, 0.0, lateral.y) * (side * 0.35));

  v_worldPosition = world;
  v_worldNormal = normal;
  v_layerColor = a_instance2;
  v_t = t;
  v_variation = a_instance1.z;
  gl_Position = u_viewProjection * vec4(world, 1.0);
}
`;
export const GRASS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 v_layerColor;
in float v_t;
in float v_variation;

uniform vec3 u_baseTint;
uniform vec3 u_tipTint;

${SCENE_LIGHTING_CHUNK}

out vec4 fragColor;

void main() {
  vec3 positionDx = dFdx(v_worldPosition);
  vec3 positionDy = dFdy(v_worldPosition);

  vec3 bladeNormal = normalize(v_worldNormal);
  if (!gl_FrontFacing) bladeNormal = -bladeNormal;
  vec3 N = normalize(mix(bladeNormal, vec3(0.0, 1.0, 0.0), 0.6));

  vec3 albedo = v_layerColor * mix(u_baseTint, u_tipTint, v_t) * (0.82 + 0.36 * v_variation);
  float occlusion = mix(0.3, 1.0, v_t);

  Surface s = makeSurface(N, v_worldPosition, albedo, 0.72, 0.0);
  vec3 hdr = shadeSurface(s, v_worldPosition, positionDx, positionDy, occlusion, vec3(0.0), 1.0);
  fragColor = vec4(finishSurfaceColor(hdr, s, 0.0), 1.0);
}
`;
