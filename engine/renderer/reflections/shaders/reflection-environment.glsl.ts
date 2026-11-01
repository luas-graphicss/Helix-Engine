import { HDR_RANGE_SCENE } from '@/engine/renderer/shaders/chunks/hdr-encoding.glsl';
export const REFLECTION_ENVIRONMENT_CHUNK = `
uniform samplerCube u_reflectionProbe;
uniform float u_reflectionProbeEnabled;
uniform float u_reflectionProbeMaxLod;
uniform float u_reflectionIntensity;

#ifndef SCENE_LIGHTING_DIRECT_SHADOW
uniform sampler2D u_screenReflections;
uniform float u_screenReflectionsEnabled;
uniform float u_screenReflectionsMaxLod;
uniform vec2 u_screenReflectionsInverseSceneSize;
uniform float u_screenReflectionsRoughnessCutoff;
#endif

                                                                                                      
vec3 probeRadiance(vec3 R, float roughness, vec3 fallback) {
  if (u_reflectionProbeEnabled < 0.5) return fallback;
  vec4 texel = textureLod(u_reflectionProbe, R, roughness * u_reflectionProbeMaxLod);
  return decodeHdr(texel, ${HDR_RANGE_SCENE}.0).rgb / max(u_exposure, 1e-3) * u_reflectionIntensity;
}

   
                                                                                    
                                                                              
                                                                                
                                                                              
                                                                                
                                                                             
                                                                            
                                                                            
                                  
   
vec3 diffuseIrradiance(vec3 N, vec3 fallback) {
  if (u_reflectionProbeEnabled < 0.5 || u_reflectionIntensity <= 0.0) return fallback;
  vec4 texel = textureLod(u_reflectionProbe, N, u_reflectionProbeMaxLod);
  return decodeHdr(texel, ${HDR_RANGE_SCENE}.0).rgb / max(u_exposure, 1e-3);
}

   
                                                                            
                                                                               
                                                                                 
                                                                    
   
vec3 reflectionRadiance(vec3 R, float roughness, vec3 fallback) {
  vec3 radiance = probeRadiance(R, roughness, fallback);
#ifndef SCENE_LIGHTING_DIRECT_SHADOW
  if (u_screenReflectionsEnabled > 0.5) {
    vec2 uv = gl_FragCoord.xy * u_screenReflectionsInverseSceneSize;
    float lod = roughness * u_screenReflectionsMaxLod;
    vec4 screen = decodeHdr(textureLod(u_screenReflections, uv, lod), ${HDR_RANGE_SCENE}.0);
    float roughnessFade = 1.0 - smoothstep(u_screenReflectionsRoughnessCutoff * 0.6, u_screenReflectionsRoughnessCutoff, roughness);
    vec3 screenRadiance = screen.rgb / max(u_exposure, 1e-3) * u_reflectionIntensity;
    radiance = mix(radiance, screenRadiance, screen.a * roughnessFade);
  }
#endif
  return radiance;
}

   
                                                                           
                                                                             
                                                          
   
float specularOcclusion(float ambientVisibility, float NdotV, float roughness) {
  return clamp(pow(NdotV + ambientVisibility, exp2(-16.0 * roughness - 1.0)) - 1.0 + ambientVisibility, 0.0, 1.0);
}
`;
