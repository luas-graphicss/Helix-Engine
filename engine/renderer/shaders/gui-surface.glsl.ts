import { COLOR_CHUNK } from './chunks/color.glsl';
import { SCENE_LIGHTING_CHUNK } from './chunks/scene-lighting.glsl';
import { SKY_LIGHTING_TEXEL } from './sky/atmosphere.glsl';
export const GUI_SURFACE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;

uniform mat4 u_viewProjection;
uniform mat4 u_model;

out vec3 v_worldPosition;
out vec2 v_uv;

void main() {
  vec4 world = u_model * vec4(a_position, 0.0, 1.0);
  v_worldPosition = world.xyz;
                                                                        
  v_uv = vec2(a_position.x + 0.5, 0.5 - a_position.y);
  gl_Position = u_viewProjection * world;
}
`;
const SURFACE_ALPHA_CHUNK = `
uniform sampler2D u_surface;
                                                
uniform float u_blend;
uniform float u_brightness;
uniform float u_opacity;

float surfaceAlpha(float texelAlpha) {
  float alpha = texelAlpha * u_opacity;
  if (u_blend > 0.5 && u_blend < 1.5 && alpha < 0.5) discard;
  return u_blend < 0.5 ? 1.0 : alpha;
}
`;
export const GUI_SURFACE_SCENE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec2 v_uv;

                                                                  
uniform vec3 u_normal;
                                                 
uniform float u_shading;
uniform float u_roughness;
uniform float u_selected;

${SCENE_LIGHTING_CHUNK}
${SURFACE_ALPHA_CHUNK}

out vec4 fragColor;

                                                                                                                  
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
  vec3 positionDx = dFdx(v_worldPosition);
  vec3 positionDy = dFdy(v_worldPosition);
  vec4 texel = texture(u_surface, v_uv);
  float alpha = surfaceAlpha(texel.a);

  vec3 N = normalize(u_normal);
  if (!gl_FrontFacing) N = -N;

  if (u_shading < 0.5) {
                                                                        
    Surface s = makeSurface(N, v_worldPosition, texel.rgb, u_roughness, 0.0);
    vec3 hdr = shadeSurface(s, v_worldPosition, positionDx, positionDy, 1.0, vec3(0.0), 1.0);
    fragColor = vec4(finishSurfaceColor(hdr, s, u_selected), alpha);
    return;
  }

                                                                                   
                                                            
  vec3 hdr = displayColorToSceneHdr(clamp(texel.rgb, 0.0, 1.0)) * u_brightness;
  hdr = fogExposed(hdr);
  vec3 V = normalize(u_cameraPosition - v_worldPosition);
  float rim = pow(1.0 - max(dot(N, V), 1e-4), 3.0);
  hdr = mix(hdr, SELECTION_TINT_HDR, u_selected * rim * 0.9);
  fragColor = sceneColorOutput(hdr, alpha);
}
`;
export const GUI_SURFACE_OVERLAY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec2 v_uv;

${COLOR_CHUNK}
${SURFACE_ALPHA_CHUNK}

out vec4 fragColor;

void main() {
  vec4 texel = texture(u_surface, v_uv);
  float alpha = surfaceAlpha(texel.a);
                                                                                              
  fragColor = vec4(linearToSrgb(clamp(texel.rgb * u_brightness, 0.0, 1.0)), alpha);
}
`;
