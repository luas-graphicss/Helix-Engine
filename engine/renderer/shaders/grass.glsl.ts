import { SCENE_LIGHTING_CHUNK } from './chunks/scene-lighting.glsl';
import { SKY_LIGHTING_TEXEL } from './sky/atmosphere.glsl';
export const GRASS_VERTEX_SHADER = `#version 300 es
precision highp float;
#define SCENE_LIGHTING_VERTEX_STAGE

layout(location = 0) in vec2 a_blade;

layout(location = 1) in vec4 a_root;

layout(location = 2) in vec4 a_shape;

layout(location = 3) in vec4 a_ground;

uniform mat4 u_viewProjection;
uniform mat4 u_model;

uniform vec4 u_blade;

uniform vec4 u_lod;

uniform vec4 u_wind;

uniform sampler2D u_trample;

uniform vec4 u_trampleParams;
uniform vec3 u_baseColor;
uniform vec3 u_tipColor;

uniform vec4 u_look;

${SCENE_LIGHTING_CHUNK}


out vec3 v_litOpen;

out vec3 v_litShadowed;

out vec3 v_translucent;

out vec4 v_fog;

const float TWO_PI = 6.28318530718;

void main() {
  float side = a_blade.x;
  float t = a_blade.y;
  vec3 root = (u_model * vec4(a_root.xyz, 1.0)).xyz;
  float yaw = a_root.w;
  float c = cos(yaw);
  float s = sin(yaw);
  vec3 forward = vec3(s, 0.0, c);
  vec3 lateral = vec3(c, 0.0, -s);


  vec2 trampleLocal = textureLod(u_trample, a_root.xz * u_trampleParams.x + 0.5, 0.0).xy * 2.0 - 1.0;
  float trampled = min(length(trampleLocal), 1.0) * u_trampleParams.w;
  vec3 trampleWorld = mat3(u_model) * vec3(trampleLocal.x, 0.0, trampleLocal.y);
  float trampleLength = length(trampleWorld.xz);
  vec2 trampleLean = trampleLength > 1e-5 ? trampleWorld.xz * (trampled * u_trampleParams.y / trampleLength) : vec2(0.0);

  float dist = distance(root, u_cameraPosition);
  float cutoffFade = 1.0 - smoothstep(u_lod.y * 0.8, u_lod.y, float(gl_InstanceID));
  float distanceFade = 1.0 - smoothstep(u_blade.z * 0.75, u_blade.z, dist);
  float presence = cutoffFade * distanceFade;
  float height = u_blade.x * (a_shape.x * 1.4 + 0.3) * presence * (1.0 - u_trampleParams.z * trampled);


  float widthScale = a_ground.a * 0.6 + 0.7;
  float halfWidth = max(u_blade.y * 0.5 * widthScale * u_lod.x, dist * u_lod.z * u_lod.w * 0.5);
  halfWidth *= (1.0 - smoothstep(0.3, 1.0, t)) * step(1e-4, height);


  float phase = a_shape.w * TWO_PI;
  vec2 windDir = u_wind.xy;
  float along = dot(root.xz, windDir);
  float across = dot(root.xz, vec2(-windDir.y, windDir.x));
  float gust = sin(along * 0.12 - u_wind.w * 1.1) * 0.5 + 0.5;
  gust *= gust;
  float ripple = sin(along * 0.45 + across * 0.3 - u_wind.w * 2.4 + phase * 0.5) * 0.5 + 0.5;
  float flutter = sin(u_wind.w * 5.0 + phase) * 0.5 + 0.5;
  float sway = u_wind.z * (0.12 + gust * 0.55 + ripple * 0.25 + flutter * 0.08);
  vec2 windLean = windDir * sway + vec2(-windDir.y, windDir.x) * (sin(u_wind.w * 2.3 + phase * 3.0) * 0.1 * u_wind.z);

  windLean *= 1.0 - 0.85 * trampled;




  float bend = u_blade.w * (0.3 + a_shape.y * 0.9) * (1.0 - trampled);
  vec2 lean = forward.xz * bend + windLean + trampleLean;
  float tipY = sqrt(max(1.0 - 0.75 * dot(lean, lean), 0.15));
  vec3 p1 = vec3(lean.x * 0.1, 0.5, lean.y * 0.1);
  vec3 p2 = vec3(lean.x, tipY, lean.y);
  float u = 1.0 - t;
  vec3 spine = (2.0 * u * t) * p1 + (t * t) * p2;
  vec3 tangent = normalize(2.0 * u * p1 + 2.0 * t * (p2 - p1));


  float twist = (fract(a_shape.w * 13.7) - 0.5) * 1.2 * t;
  vec3 sideDir = lateral * cos(twist) + forward * sin(twist);

  vec3 world = root + spine * height + sideDir * (side * halfWidth);


  vec3 bladeNormal = normalize(cross(sideDir, tangent));
  bladeNormal = normalize(bladeNormal + sideDir * (side * 0.45));
  if (dot(bladeNormal, u_cameraPosition - world) < 0.0) bladeNormal = -bladeNormal;

  vec3 N = normalize(mix(bladeNormal, vec3(0.0, 1.0, 0.0), 0.55));


  vec3 ground = srgbToLinear(a_ground.rgb);
  float variation = a_shape.z;
  vec3 dry = u_tipColor * vec3(1.35, 1.05, 0.55);
  float dryness = smoothstep(0.35, 0.9, variation) * u_look.x;
  vec3 tip = mix(u_tipColor, dry, dryness) * (0.85 + 0.3 * variation);
  vec3 base = mix(u_baseColor, ground * 0.75, u_look.y);
  vec3 albedo = mix(base, tip, smoothstep(0.0, 0.85, t));
  albedo = mix(ground * 0.8, albedo, distanceFade);
  float occlusion = mix(0.35, 1.0, smoothstep(0.0, 0.6, t));

  Surface surf = makeSurface(N, world, albedo, 0.55, 0.0);
  vec3 sunRadiance = u_sunRadiance;
  vec3 moonRadiance = u_moonRadiance;
  vec3 skyIrradiance = u_skyIrradiance;
  vec3 groundIrradiance = u_groundIrradiance;
  if (u_skyLightingEnabled > 0.5) {
    sunRadiance *= skyLightingTexel(${SKY_LIGHTING_TEXEL.sunTransmittance});
    moonRadiance *= skyLightingTexel(${SKY_LIGHTING_TEXEL.moonTransmittance});
    skyIrradiance = skyLightingTexel(${SKY_LIGHTING_TEXEL.skyIrradiance});
    groundIrradiance = skyLightingTexel(${SKY_LIGHTING_TEXEL.groundIrradiance});
  }
  bool shadowOnMoon = u_shadowOnMoon > 0.5;
  vec3 sun = directLight(surf, u_sunDirection, sunRadiance, 1.0);
  vec3 moon = directLight(surf, u_moonDirection, moonRadiance, 1.0);
  float hemisphere = N.y * 0.5 + 0.5;
  vec3 ambientIrradiance = mix(groundIrradiance, skyIrradiance, hemisphere) * occlusion;
  vec3 ambient = surf.diffuseColor * ambientIrradiance + environmentBrdf(surf.f0, surf.roughness, surf.NdotV) * ambientIrradiance;
  v_litShadowed = shadowOnMoon ? moon : sun;
  v_litOpen = (shadowOnMoon ? sun : moon) + ambient;


  float backlight = pow(clamp(dot(-surf.V, u_sunDirection), 0.0, 1.0), 3.0) * clamp(u_sunDirection.y * 4.0, 0.0, 1.0);
  float translucency = backlight * smoothstep(0.15, 1.0, t) * u_look.z * distanceFade;
  v_translucent = tip * sunRadiance * (translucency * 1.5 / PI);

  v_fog = aerialFog(world, skyIrradiance, sunRadiance);
  gl_Position = u_viewProjection * vec4(world, 1.0);
}
`;
export const GRASS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_litOpen;
in vec3 v_litShadowed;
in vec3 v_translucent;
in vec4 v_fog;


uniform vec4 u_look;

${SCENE_LIGHTING_CHUNK}

out vec4 fragColor;

void main() {
  vec2 mask = shadowMaskSample();
  float visibility = mix(1.0, mask.r, u_look.w) * mask.g;

  float sunVisibility = u_shadowOnMoon > 0.5 ? mask.g : visibility;
  vec3 hdr = v_litOpen + v_litShadowed * visibility + v_translucent * sunVisibility;
  hdr = mix(hdr, v_fog.rgb, v_fog.a);
  vec3 color = linearToSrgb(tonemapAces(hdr * u_exposure));
  fragColor = vec4(color, 1.0);
}
`;
