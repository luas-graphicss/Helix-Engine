import { COLOR_CHUNK } from './chunks/color.glsl';
import { SCENE_LIGHTING_CHUNK } from './chunks/scene-lighting.glsl';
import { SKY_LIGHTING_TEXEL } from './sky/atmosphere.glsl';
export const VFX_INSTANCE_FLOATS = 14;
export const VFX_RENDER_MODE_CODE = { billboard: 0, stretched: 1, horizontal: 2, vertical: 3 } as const;
export const VFX_BLEND_CODE = { alpha: 0, additive: 1, premultiplied: 2, multiply: 3 } as const;
export const VFX_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec3 a_position;
layout(location = 2) in vec2 a_size;
layout(location = 3) in float a_rotation;
layout(location = 4) in vec4 a_color;
layout(location = 5) in float a_frame;
layout(location = 6) in vec3 a_velocity;

uniform mat4 u_viewProjection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform vec3 u_cameraPosition;
                                                        
uniform float u_mode;
uniform float u_alignToVelocity;
uniform float u_stretch;
uniform float u_stretchMinimum;
uniform vec2 u_pivot;
                                                         
uniform vec2 u_flipbook;

out vec3 v_worldPosition;
out vec2 v_uv;
out vec4 v_color;
out vec3 v_normal;

${COLOR_CHUNK}

mat2 rotation2(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, s, -s, c);
}

void main() {
  vec3 center = (u_model * vec4(a_position, 1.0)).xyz;
                                                                                         
  float modelScale = length(u_model[0].xyz);
  vec2 size = a_size * modelScale;
  vec3 velocity = mat3(u_model) * a_velocity;

  vec3 cameraRight = vec3(u_view[0][0], u_view[1][0], u_view[2][0]);
  vec3 cameraUp = vec3(u_view[0][1], u_view[1][1], u_view[2][1]);
  vec3 toCamera = normalize(u_cameraPosition - center);

  vec3 right;
  vec3 up;
  float angle = a_rotation;
  if (u_mode < 0.5) {
    right = cameraRight;
    up = cameraUp;
    if (u_alignToVelocity > 0.5) {
                                                                                
      vec2 screenVelocity = vec2(dot(velocity, cameraRight), dot(velocity, cameraUp));
      if (dot(screenVelocity, screenVelocity) > 1e-8) angle += atan(screenVelocity.y, screenVelocity.x) - 1.5707963;
    }
  } else if (u_mode < 1.5) {
                                                                                                                
    float speed = length(velocity);
    vec3 planar = velocity - toCamera * dot(velocity, toCamera);
    float planarLength = length(planar);
    up = planarLength > 1e-5 ? planar / planarLength : cameraUp;
    right = normalize(cross(up, toCamera));
    size.y *= max(u_stretchMinimum, 1.0 + u_stretch * speed);
    angle = 0.0;
  } else if (u_mode < 2.5) {
                                 
    right = vec3(1.0, 0.0, 0.0);
    up = vec3(0.0, 0.0, -1.0);
  } else {
                                                             
    up = vec3(0.0, 1.0, 0.0);
    vec3 level = vec3(toCamera.x, 0.0, toCamera.z);
    right = length(level) > 1e-5 ? normalize(cross(up, level)) : vec3(1.0, 0.0, 0.0);
  }

  vec2 local = (a_corner - (u_pivot - 0.5)) * size;
  local = rotation2(angle) * local;
  vec3 world = center + right * local.x + up * local.y;

  v_worldPosition = world;
  v_normal = u_mode > 1.5 && u_mode < 2.5 ? vec3(0.0, 1.0, 0.0) : toCamera;
  v_color = vec4(srgbToLinear(clamp(a_color.rgb, 0.0, 1.0)), a_color.a);

                                                                                                  
  vec2 uv = vec2(a_corner.x + 0.5, 0.5 - a_corner.y);
  float frameCount = u_flipbook.x * u_flipbook.y;
  float frame = mod(floor(a_frame), max(frameCount, 1.0));
  vec2 cell = vec2(mod(frame, u_flipbook.x), floor(frame / u_flipbook.x));
  v_uv = (uv + cell) / u_flipbook;

  gl_Position = u_viewProjection * vec4(world, 1.0);
}
`;
export const VFX_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec2 v_uv;
in vec4 v_color;
in vec3 v_normal;

uniform sampler2D u_sprite;
uniform sampler2D u_sceneDepth;
                                                                    
uniform vec4 u_depthParams;
                                                                             
uniform float u_blend;
uniform float u_intensity;
uniform float u_softness;
uniform float u_fadeNear;
uniform float u_alphaCutoff;
                                             
uniform float u_lit;

${SCENE_LIGHTING_CHUNK}

out vec4 fragColor;

float linearDepth(float sampled) {
  float ndc = sampled * 2.0 - 1.0;
  float n = u_depthParams.x;
  float f = u_depthParams.y;
  return 2.0 * n * f / (f + n - ndc * (f - n));
}

                                                                              
vec3 fogExposed(vec3 exposedHdr) {
  vec3 sunRadiance = u_sunRadiance;
  vec3 skyIrradiance = u_skyIrradiance;
  if (u_skyLightingEnabled > 0.5) {
    sunRadiance *= skyLightingTexel(${SKY_LIGHTING_TEXEL.sunTransmittance});
    skyIrradiance = skyLightingTexel(${SKY_LIGHTING_TEXEL.skyIrradiance});
  }
  vec4 fog = aerialFog(v_worldPosition, skyIrradiance, sunRadiance);
  return mix(exposedHdr, fog.rgb * u_exposure, fog.a);
}

void main() {
  vec4 texel = texture(u_sprite, v_uv);
  float alpha = v_color.a * texel.a;
  if (u_alphaCutoff > 0.0 && alpha < u_alphaCutoff) discard;

  float fragmentDepth = linearDepth(gl_FragCoord.z);
  if (u_softness > 0.0) {
                                                                                                      
    float sceneDepth = linearDepth(texture(u_sceneDepth, gl_FragCoord.xy * u_depthParams.zw).r);
    alpha *= clamp((sceneDepth - fragmentDepth) / u_softness, 0.0, 1.0);
  }
  if (u_fadeNear > 0.0) alpha *= clamp((fragmentDepth - u_depthParams.x) / u_fadeNear, 0.0, 1.0);
  if (alpha <= 0.0005 && u_blend < 2.5) discard;

  vec3 base = v_color.rgb * texel.rgb;
  vec3 hdr;
  if (u_lit > 0.5) {
                                                                                            
    vec3 N = normalize(v_normal);
    Surface s = makeSurface(N, v_worldPosition, base, 1.0, 0.0);
    hdr = shadeSurface(s, v_worldPosition, vec3(0.0), vec3(0.0), 1.0, vec3(0.0), 1.0) * u_exposure * u_intensity;
  } else {
                                                                                                              
    hdr = fogExposed(displayColorToSceneHdr(base) * u_intensity);
  }

  if (u_blend < 0.5) {
    fragColor = sceneColorOutput(hdr, alpha);
  } else if (u_blend < 1.5) {
                                                    
    fragColor = sceneColorOutput(hdr, alpha);
  } else if (u_blend < 2.5) {
                                                                                                                 
    fragColor = sceneColorOutput(hdr * v_color.a, alpha);
  } else {
                                                                              
    fragColor = vec4(mix(vec3(1.0), base, alpha), 1.0);
  }
}
`;
