import { BRDF_CHUNK } from './brdf.glsl';
import { COLOR_CHUNK } from './color.glsl';
import { CLOUD_SHADOW_CHUNK } from './cloud-shadow-sampling.glsl';
import { HDR_ENCODING_CHUNK, HDR_RANGE_LIGHTING, HDR_RANGE_SCENE } from './hdr-encoding.glsl';
import { LOCAL_LIGHTS_CHUNK } from './local-lights.glsl';
import { SHADOW_MASK_ENCODING_CHUNK } from './shadow-mask-encoding.glsl';
import { SHADOW_SAMPLING_CHUNK } from './shadow-sampling.glsl';
import { SKY_LIGHTING_TEXEL } from '../sky/atmosphere.glsl';
import { REFLECTION_ENVIRONMENT_CHUNK } from '@/engine/renderer/reflections/shaders/reflection-environment.glsl';
export const SCENE_LIGHTING_CHUNK = `
uniform vec3 u_cameraPosition;
uniform float u_exposure;

uniform vec3 u_sunDirection;
uniform vec3 u_sunRadiance;
uniform vec3 u_moonDirection;
uniform vec3 u_moonRadiance;
uniform vec3 u_skyIrradiance;
uniform vec3 u_groundIrradiance;
                                                            
uniform float u_shadowOnMoon;

uniform sampler2D u_skyLightingLut;
uniform float u_skyLightingEnabled;
                                                              
uniform float u_fogDensity;

${BRDF_CHUNK}
${HDR_ENCODING_CHUNK}
${COLOR_CHUNK}
${REFLECTION_ENVIRONMENT_CHUNK}

                                                                                                                  
const vec3 SELECTION_TINT_HDR = vec3(3.05, 0.228, 0.0234);

                                                                                                  
const float CELESTIAL_SIN_ANGULAR_RADIUS = 0.00465;

struct Surface {
                                                        
  vec3 N;
                                                                                                       
  vec3 geometricN;
  vec3 V;
  float NdotV;
  float roughness;
  float alpha;
  vec3 f0;
  vec3 diffuseColor;
                                                                                                           
  vec2 dfg;
  vec3 energyCompensation;
};

Surface makeSurface(vec3 N, vec3 worldPosition, vec3 baseColor, float roughness, float metallic) {
  Surface s;
  s.N = N;
  s.geometricN = N;
  s.V = normalize(u_cameraPosition - worldPosition);
  s.NdotV = max(dot(s.N, s.V), 1e-4);
  s.roughness = clamp(roughness, 0.045, 1.0);
  s.alpha = s.roughness * s.roughness;
  s.f0 = mix(vec3(0.04), baseColor, metallic);
  s.diffuseColor = baseColor * (1.0 - metallic);
  s.dfg = environmentBrdfTerms(s.roughness, s.NdotV);
  s.energyCompensation = multiScatterCompensation(s.f0, s.dfg);
  return s;
}

vec3 skyLightingTexel(int index) {
  return decodeHdr(texelFetch(u_skyLightingLut, ivec2(index, 0), 0), ${HDR_RANGE_LIGHTING}.0).rgb;
}

                                                                                                                       
vec3 directLight(Surface s, vec3 L, vec3 radiance, float visibility) {
  float NdotL = dot(s.N, L);
  if (NdotL <= 0.0 || visibility <= 0.0) return vec3(0.0);
  vec3 H = normalize(L + s.V);
  float NdotH = max(dot(s.N, H), 0.0);
  float VdotH = max(dot(s.V, H), 0.0);
  vec3 F = fresnelSchlick(VdotH, s.f0);
  float a2 = s.alpha * s.alpha;
  float discA2 = discLightAlpha2(a2, CELESTIAL_SIN_ANGULAR_RADIUS, VdotH);
  float D = distributionGgxA2(NdotH, discA2) * (a2 / discA2);
  vec3 specular = D * visibilitySmithGgxCorrelated(s.NdotV, NdotL, s.alpha) * F * s.energyCompensation;
  vec3 diffuse = (1.0 - F) * s.diffuseColor / PI;
  return (diffuse + specular) * radiance * (NdotL * visibility);
}

   
                                                                              
                                                                             
                                                                             
                                                
   
float microShadow(float occlusion, float NdotL) {
  float aperture = 2.0 * occlusion * occlusion;
  return clamp(abs(NdotL) + aperture - 1.0, 0.0, 1.0);
}

   
                                                                                
                                                                            
                                                                                   
                                                                       
                                                                                 
                                                                             
                                                                             
                                                                              
                                                               
   
const float SHADOW_AMBIENT_FLOOR = 0.8;
   
                                                                         
                                                                                  
                                                                           
                                
   
const float SKY_OCCLUSION_STRENGTH = 0.85;
   
                                                                                
                                                                               
                                                                               
                               
   
const float SHADOW_AMBIENT_TERMINATOR = 0.3;

                                                                                                                  
float shadowAmbientOcclusion(float castVisibility, float NdotL) {
  return 1.0 - (1.0 - SHADOW_AMBIENT_FLOOR) * (1.0 - castVisibility) * smoothstep(0.0, SHADOW_AMBIENT_TERMINATOR, NdotL);
}

   
                                                                                 
                                                                               
                                                                              
                                                                                
                                            
   
float sunlitGroundFraction(float visibility, float NdotL) {
  return visibility * smoothstep(0.0, SHADOW_AMBIENT_TERMINATOR, NdotL);
}

#ifdef SCENE_LIGHTING_DIRECT_SHADOW
${SHADOW_SAMPLING_CHUNK}
${CLOUD_SHADOW_CHUNK}

                                                                                                                    
const bool SHADOW_READ_FACING_AWAY = false;

 
vec3 surfaceShadow(vec3 worldPosition, vec3 N, vec3 L, float NdotL, vec3 positionDx, vec3 positionDy) {
  float visibility = u_shadowEnabled > 0.5 ? sampleDirectionalShadow(worldPosition, N, L, NdotL, positionDx, positionDy) : 1.0;
  return vec3(visibility, cloudShadow(worldPosition, L), 0.0);
}
#else
                                                                                                                                             
uniform highp usampler2D u_shadowMask;
uniform float u_shadowMaskEnabled;
                                                                                                                
uniform float u_shadowMaskScale;

                                                                                                                         
const bool SHADOW_READ_FACING_AWAY = true;

${SHADOW_MASK_ENCODING_CHUNK}

#ifndef SCENE_LIGHTING_VERTEX_STAGE
 
vec2 viewDistanceGradient(vec3 worldPosition, vec3 positionDx, vec3 positionDy) {
  vec3 toSurface = worldPosition - u_cameraPosition;
  vec3 viewDir = toSurface * inversesqrt(max(dot(toSurface, toSurface), 1e-8));
  return vec2(dot(viewDir, positionDx), dot(viewDir, positionDy));
}

 
vec3 shadowMaskSample(float viewDistance, vec2 gradient) {
  if (u_shadowMaskEnabled < 0.5) return vec3(1.0, 1.0, 0.0);
  if (u_shadowMaskScale >= 1.0) return decodeShadowMask(texelFetch(u_shadowMask, ivec2(gl_FragCoord.xy), 0)).rga;

  float block = 1.0 / u_shadowMaskScale;
  vec2 p = gl_FragCoord.xy * u_shadowMaskScale - 0.5;
  ivec2 i = ivec2(floor(p));
  vec2 f = p - vec2(i);
  ivec2 limit = textureSize(u_shadowMask, 0) - 1;
  vec4 m00 = decodeShadowMask(texelFetch(u_shadowMask, clamp(i, ivec2(0), limit), 0));
  vec4 m10 = decodeShadowMask(texelFetch(u_shadowMask, clamp(i + ivec2(1, 0), ivec2(0), limit), 0));
  vec4 m01 = decodeShadowMask(texelFetch(u_shadowMask, clamp(i + ivec2(0, 1), ivec2(0), limit), 0));
  vec4 m11 = decodeShadowMask(texelFetch(u_shadowMask, clamp(i + ivec2(1, 1), ivec2(0), limit), 0));

                                                                                                            
  float slope = abs(gradient.x) + abs(gradient.y);
  float nearestBias = 0.5 * (block - 1.0) * slope;
                                                                                                
  vec2 toOrigin = (vec2(i) + 0.5) * block - gl_FragCoord.xy;
  float d00 = viewDistance + dot(gradient, toOrigin) - nearestBias;
  float d10 = d00 + gradient.x * block;
  float d01 = d00 + gradient.y * block;
  float d11 = d10 + gradient.y * block;
                                                                                                          
                                                                                                  
  float reference = max(viewDistance, 1e-3);
  float k = 1.0 / clamp(0.5 * block * slope, 0.01 * reference, 0.1 * reference);
  float w00 = (1.0 - f.x) * (1.0 - f.y) * exp(-abs(m00.b - d00) * k);
  float w10 = f.x * (1.0 - f.y) * exp(-abs(m10.b - d10) * k);
  float w01 = (1.0 - f.x) * f.y * exp(-abs(m01.b - d01) * k);
  float w11 = f.x * f.y * exp(-abs(m11.b - d11) * k);
  float sum = w00 + w10 + w01 + w11;
  if (sum > 1e-20) return (m00.rga * w00 + m10.rga * w10 + m01.rga * w01 + m11.rga * w11) / sum;
                                                                                                       
                                                    
  return mix(mix(m00.rga, m10.rga, f.x), mix(m01.rga, m11.rga, f.x), f.y);
}

                                                                                                                            
vec3 surfaceShadow(vec3 worldPosition, vec3 N, vec3 L, float NdotL, vec3 positionDx, vec3 positionDy) {
  vec2 gradient = viewDistanceGradient(worldPosition, positionDx, positionDy);
  return shadowMaskSample(distance(u_cameraPosition, worldPosition), gradient);
}
#endif
#endif

${LOCAL_LIGHTS_CHUNK}

const float FOG_MAX = 0.92;

   
                                                                               
                                                                        
                                                           
   
vec4 aerialFog(vec3 worldPosition, vec3 skyIrradiance, vec3 sunRadiance) {
  if (u_fogDensity <= 0.0) return vec4(0.0);
  vec3 toSurface = worldPosition - u_cameraPosition;
  float dist = length(toSurface);
  vec3 viewDir = toSurface / max(dist, 1e-4);
  float amount = min(1.0 - exp(-dist * u_fogDensity), FOG_MAX);
                                                                                                  
  float sunForward = pow(max(dot(viewDir, u_sunDirection), 0.0), 8.0);
  vec3 fogColor = skyIrradiance * 0.8 + sunRadiance * (0.02 * sunForward);
  return vec4(fogColor, amount);
}

vec3 aerialPerspective(vec3 color, vec3 worldPosition, vec3 skyIrradiance, vec3 sunRadiance) {
  vec4 fog = aerialFog(worldPosition, skyIrradiance, sunRadiance);
  return mix(color, fog.rgb, fog.a);
}

#ifndef SCENE_LIGHTING_VERTEX_STAGE
   
                                                                       
                                                                         
                                                                          
                                                                               
                                    
   
vec3 shadeSurface(Surface s, vec3 worldPosition, vec3 positionDx, vec3 positionDy, float occlusion, vec3 emissive, float receiveShadows) {
  vec3 sunRadiance = u_sunRadiance;
  vec3 moonRadiance = u_moonRadiance;
  vec3 skyIrradiance = u_skyIrradiance;
  vec3 groundIrradiance = u_groundIrradiance;
                                                                                              
  vec3 shadedGroundIrradiance = groundIrradiance;
  if (u_skyLightingEnabled > 0.5) {
    sunRadiance *= skyLightingTexel(${SKY_LIGHTING_TEXEL.sunTransmittance});
    moonRadiance *= skyLightingTexel(${SKY_LIGHTING_TEXEL.moonTransmittance});
    skyIrradiance = skyLightingTexel(${SKY_LIGHTING_TEXEL.skyIrradiance});
    groundIrradiance = skyLightingTexel(${SKY_LIGHTING_TEXEL.groundIrradiance});
    shadedGroundIrradiance = skyLightingTexel(${SKY_LIGHTING_TEXEL.shadedGroundIrradiance});
  }

                                                                               
                                                                                
                                                                             
                                                         
  bool shadowOnMoon = u_shadowOnMoon > 0.5;
  vec3 shadowLight = shadowOnMoon ? u_moonDirection : u_sunDirection;
  vec3 shadowRadiance = shadowOnMoon ? moonRadiance : sunRadiance;
  float shadowNdotL = dot(s.N, shadowLight);
  float visibility = 1.0;
  float ambientShadow = 1.0;
  float sunlitGround = 0.0;
  if ((shadowNdotL > 0.0 || SHADOW_READ_FACING_AWAY) && any(greaterThan(shadowRadiance, vec3(0.0)))) {
    vec3 shadow = surfaceShadow(worldPosition, s.N, shadowLight, shadowNdotL, positionDx, positionDy);
    float castVisibility = mix(1.0, shadow.x, receiveShadows);
    visibility = castVisibility * shadow.y;
    sunlitGround = sunlitGroundFraction(visibility, shadowNdotL);
                                                                                                             
                                                                                                                            
    ambientShadow = shadowAmbientOcclusion(castVisibility, shadowNdotL) * (1.0 - SKY_OCCLUSION_STRENGTH * shadow.z * receiveShadows);
  }

  vec3 color = vec3(0.0);
  if (any(greaterThan(sunRadiance, vec3(0.0)))) {
    float sunVisibility = (shadowOnMoon ? 1.0 : visibility) * microShadow(occlusion, dot(s.N, u_sunDirection));
    color += directLight(s, u_sunDirection, sunRadiance, sunVisibility);
  }
  if (any(greaterThan(moonRadiance, vec3(0.0)))) {
    float moonVisibility = (shadowOnMoon ? visibility : 1.0) * microShadow(occlusion, dot(s.N, u_moonDirection));
    color += directLight(s, u_moonDirection, moonRadiance, moonVisibility);
  }

                                                                                                  
  color += localLightsContribution(s, worldPosition);

                                                                                                                    
                                                                                                                  
                                                                                                                 
  float hemisphere = s.N.y * 0.5 + 0.5;
  vec3 groundBounce = mix(shadedGroundIrradiance, groundIrradiance, sunlitGround);
  vec3 hemisphereIrradiance = mix(groundBounce, skyIrradiance, hemisphere);
  vec3 ambientIrradiance = diffuseIrradiance(s.N, hemisphereIrradiance);
  float ambientVisibility = occlusion * ambientShadow;
  color += s.diffuseColor * ambientIrradiance * ambientVisibility;
                                                                                                                       
                                                                                                                    
  vec3 R = reflect(-s.V, s.N);
  vec3 reflected = reflectionRadiance(R, s.roughness, ambientIrradiance);
  float horizon = clamp(1.0 + dot(R, s.geometricN), 0.0, 1.0);
  float ambientSpecularVisibility = specularOcclusion(ambientVisibility, s.NdotV, s.roughness) * horizon * horizon;
  color += environmentBrdf(s.f0, s.dfg) * s.energyCompensation * reflected * ambientSpecularVisibility;
  return aerialPerspective(color + emissive, worldPosition, skyIrradiance, sunRadiance);
}

                                                                                                           
vec3 exposeSurfaceColor(vec3 hdr, Surface s, float selected) {
  vec3 color = hdr * u_exposure;
  float rim = pow(1.0 - s.NdotV, 3.0);
  return mix(color, SELECTION_TINT_HDR, selected * rim * 0.9);
}

                                                                                                                
vec4 sceneColorOutput(vec3 exposedHdr, float alpha) {
  return encodeHdr(exposedHdr, alpha, ${HDR_RANGE_SCENE}.0);
}

                                                                                                                    
vec3 displayColorToSceneHdr(vec3 display) {
  return tonemapAcesInverse(display);
}

vec3 finishSurfaceColor(vec3 hdr, Surface s, float selected) {
  return sceneColorOutput(exposeSurfaceColor(hdr, s, selected), 1.0).rgb;
}
#endif
`;
