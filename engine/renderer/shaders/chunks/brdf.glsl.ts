export const BRDF_CHUNK = `
const float PI = 3.14159265359;

float distributionGgxA2(float NdotH, float a2) {
  float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}

float distributionGgx(float NdotH, float alpha) {
  return distributionGgxA2(NdotH, alpha * alpha);
}

float visibilitySmithGgxCorrelated(float NdotV, float NdotL, float alpha) {
  float a2 = alpha * alpha;
  float ggxV = NdotL * sqrt(NdotV * NdotV * (1.0 - a2) + a2);
  float ggxL = NdotV * sqrt(NdotL * NdotL * (1.0 - a2) + a2);
  return 0.5 / max(ggxV + ggxL, 1e-4);
}

vec3 fresnelSchlick(float VdotH, vec3 f0) {
  float f = pow(1.0 - VdotH, 5.0);
  return f0 + (1.0 - f0) * f;
}

   
                                                                             
                                                                            
                                                                           
                            
   
vec2 environmentBrdfTerms(float roughness, float NdotV) {
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = roughness * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
  return vec2(-1.04, 1.04) * a004 + r.zw;
}

vec3 environmentBrdf(vec3 f0, vec2 terms) {
  return f0 * terms.x + terms.y;
}

   
                                                                                
                                                                         
                                                                          
                                                                              
                                                                               
                                                                      
   
vec3 multiScatterCompensation(vec3 f0, vec2 terms) {
  float singleScatter = terms.x + terms.y;
  return 1.0 + f0 * (1.0 / max(singleScatter, 1e-3) - 1.0);
}

   
                                                                          
                                                                        
                                                                         
                                                                           
   
float discLightAlpha2(float a2, float sinAlpha, float VdotH) {
  return a2 + 0.25 * sinAlpha * (3.0 * sqrt(a2) + sinAlpha) / (VdotH + 0.001);
}
`;
