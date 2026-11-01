export const SCREEN_TRACE_CHUNK = `
struct ScreenTrace {
  bool hit;
                                                         
  vec2 uv;
                                                                                                    
  float confidence;
};

                                                                                                            
float viewZFromDepth(float depth) {
  float ndcZ = depth * 2.0 - 1.0;
  return -u_projection[3][2] / (ndcZ + u_projection[2][2]);
}

float screenEdgeFade(vec2 uv) {
  vec2 fade = smoothstep(vec2(0.0), vec2(0.08), uv) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - uv);
  return fade.x * fade.y;
}

   
                                                                             
                                                                             
                                                                               
                                                                                   
                                                                           
                                                                                     
   
float skyDirectionUv(vec3 viewDirection, out vec2 uv) {
  vec4 clip = u_projection * vec4(viewDirection, 0.0);
  uv = vec2(0.0);
  if (clip.w <= 1e-4) return 0.0;
  uv = clip.xy / clip.w * 0.5 + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  float depth = texelFetch(u_sceneDepth, clamp(ivec2(uv * u_sceneSize), ivec2(0), ivec2(u_sceneSize) - 1), 0).r;
  if (depth < 1.0) return 0.0;
  return screenEdgeFade(uv);
}

ScreenTrace traceScreenRay(vec3 origin, vec3 direction) {
  ScreenTrace result;
  result.hit = false;
  result.uv = vec2(0.0);
  result.confidence = 0.0;

  float maxSteps = u_traceParams.x;
  float stride = u_traceParams.y;
  float thickness = u_traceParams.z;
  float maxDistance = u_traceParams.w;

                                                                                          
  float rayLength = (origin.z + direction.z * maxDistance > -u_nearPlane) ? (-u_nearPlane - origin.z) / direction.z : maxDistance;
  vec3 endPoint = origin + direction * rayLength;

  vec4 H0 = u_projection * vec4(origin, 1.0);
  vec4 H1 = u_projection * vec4(endPoint, 1.0);
  float k0 = 1.0 / H0.w;
  float k1 = 1.0 / H1.w;
  vec3 Q0 = origin * k0;
  vec3 Q1 = endPoint * k1;
  vec2 P0 = (H0.xy * k0 * 0.5 + 0.5) * u_sceneSize;
  vec2 P1 = (H1.xy * k1 * 0.5 + 0.5) * u_sceneSize;
                                                                                              
  P1 += vec2(dot(P1 - P0, P1 - P0) < 0.0001 ? 0.01 : 0.0);

  vec2 delta = P1 - P0;
  bool permute = false;
  if (abs(delta.x) < abs(delta.y)) {
    permute = true;
    delta = delta.yx;
    P0 = P0.yx;
    P1 = P1.yx;
  }
  float stepDir = sign(delta.x);
  float invdx = stepDir / delta.x;
  vec3 dQ = (Q1 - Q0) * invdx;
  float dk = (k1 - k0) * invdx;
  vec2 dP = vec2(stepDir, delta.y * invdx);
  dP *= stride;
  dQ *= stride;
  dk *= stride;

  vec2 P = P0;
  vec3 Q = Q0;
  float k = k0;
  float end = P1.x * stepDir;
  float prevRayZ = origin.z;
  float sceneZ = 0.0;
  float steps = 0.0;
  vec2 hitPixel = vec2(0.0);

  for (float i = 0.0; i < maxSteps; i += 1.0) {
    P += dP;
    Q.z += dQ.z;
    k += dk;
    steps = i + 1.0;
    if (P.x * stepDir > end) break;

    hitPixel = permute ? P.yx : P;
    if (any(lessThan(hitPixel, vec2(0.0))) || any(greaterThanEqual(hitPixel, u_sceneSize))) break;
    sceneZ = viewZFromDepth(texelFetch(u_sceneDepth, ivec2(hitPixel), 0).r);

                                                                             
                                                                               
                                                                                 
                                                                                  
                                                                         
                                                                            
                                                             
    float rayZ = Q.z / k;
                                                                               
                                                                                
                                                                                    
    float layer = thickness * (1.0 + 0.04 * abs(sceneZ));
    float reach = max(layer, abs(rayZ - prevRayZ));
    if (rayZ <= sceneZ && rayZ >= sceneZ - reach) {
      result.hit = true;
      break;
    }
    prevRayZ = rayZ;
  }
  if (!result.hit) return result;

                                                                                           
  vec2 pStep = dP * 0.5;
  float qStep = dQ.z * 0.5;
  float kStep = dk * 0.5;
  P -= dP;
  Q.z -= dQ.z;
  k -= dk;
  for (int r = 0; r < 5; r++) {
    vec2 Pm = P + pStep;
    float Qm = Q.z + qStep;
    float km = k + kStep;
    vec2 pixel = permute ? Pm.yx : Pm;
    float sz = viewZFromDepth(texelFetch(u_sceneDepth, clamp(ivec2(pixel), ivec2(0), ivec2(u_sceneSize) - 1), 0).r);
    if (Qm / km > sz) {
      P = Pm;
      Q.z = Qm;
      k = km;
    }
    pStep *= 0.5;
    qStep *= 0.5;
    kStep *= 0.5;
  }
  hitPixel = permute ? P.yx : P;
  hitPixel = clamp(hitPixel, vec2(0.0), u_sceneSize - 1.0);
  sceneZ = viewZFromDepth(texelFetch(u_sceneDepth, ivec2(hitPixel), 0).r);
  float behind = sceneZ - Q.z / k;
  float layer = thickness * (1.0 + 0.04 * abs(sceneZ));

  result.uv = (hitPixel + 0.5) / u_sceneSize;
  float travelFade = 1.0 - (steps / maxSteps) * (steps / maxSteps);
  float thicknessFade = 1.0 - smoothstep(0.0, layer, behind);
  result.confidence = screenEdgeFade(result.uv) * travelFade * thicknessFade;
  return result;
}
`;
