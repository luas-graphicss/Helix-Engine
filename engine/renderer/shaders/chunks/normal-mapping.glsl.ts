export const NORMAL_MAPPING_CHUNK = `
                                                                                                       
const float ROUGHNESS_VARIANCE_LIMIT = 0.18;
                                                                                        
const float SPECULAR_AA_VARIANCE = 0.15;
                                                                                                        
const float NORMAL_LENGTH_TOLERANCE = 0.005;

struct TangentFrame {
  vec3 T;
  vec3 B;
  vec3 N;
};

   
                                                                           
                                                                                
                                                                             
                                                                                    
   
TangentFrame tangentFrame(vec3 N, vec4 worldTangent, bool frontFacing) {
  TangentFrame f;
  vec3 t = worldTangent.xyz - N * dot(N, worldTangent.xyz);
  f.T = t * inversesqrt(max(dot(t, t), 1e-12));
  f.B = cross(N, f.T) * (worldTangent.w < 0.0 ? -1.0 : 1.0);
  f.N = N;
  if (!frontFacing) {
    f.T = -f.T;
    f.B = -f.B;
    f.N = -f.N;
  }
  return f;
}

   
                                                                             
                                                                            
                                                                           
                                                                               
                                                                  
   
vec3 perturbNormal(TangentFrame f, vec3 texel, float normalScale, inout float roughnessVariance) {
  vec3 mapN = texel * 2.0 - 1.0;
  float len = min(length(mapN), 1.0);
  float shortening = max(1.0 - len - NORMAL_LENGTH_TOLERANCE, 0.0);
  roughnessVariance += shortening / max(len, 0.5);
  mapN.xy *= normalScale;
  return normalize(f.T * mapN.x + f.B * mapN.y + f.N * mapN.z);
}

   
                                                                               
                                                                           
                                                                            
                                                                               
                      
   
float geometricRoughnessVariance(vec3 normalDx, vec3 normalDy) {
  return 2.0 * SPECULAR_AA_VARIANCE * (dot(normalDx, normalDx) + dot(normalDy, normalDy));
}

                                                                                                  
float filteredRoughness(float roughness, float roughnessVariance) {
  float alpha = roughness * roughness;
  float alpha2 = alpha * alpha + min(roughnessVariance, ROUGHNESS_VARIANCE_LIMIT);
  return sqrt(sqrt(alpha2));
}
`;
