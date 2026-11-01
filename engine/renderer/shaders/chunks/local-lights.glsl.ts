import { LIGHT_DATA_WIDTH, LIGHT_DATA_WIDTH_SHIFT, LIGHT_TEXELS, SHADOW_SLOT_TEXELS, SHADOW_SLOTS_OFFSET, TILE_BITS_PER_CHANNEL, } from '@/engine/renderer/lighting/local-light-layout';
export const LOCAL_LIGHTS_CHUNK = `
uniform highp sampler2D u_localLightData;
uniform highp int u_localLightCount;
                                                                                   
uniform highp ivec3 u_localLightTiles;
                                                                                             
uniform vec2 u_localLightViewport;
uniform highp sampler2DArrayShadow u_localShadowAtlas;
                                           
uniform float u_localShadowTexel;

const int LOCAL_LIGHT_TEXELS = ${LIGHT_TEXELS};
const int LOCAL_SHADOW_SLOTS_OFFSET = ${SHADOW_SLOTS_OFFSET};
const int LOCAL_SHADOW_SLOT_TEXELS = ${SHADOW_SLOT_TEXELS};
const int LOCAL_TILE_BITS = ${TILE_BITS_PER_CHANNEL};

vec4 localLightTexel(int index) {
  return texelFetch(u_localLightData, ivec2(index & ${LIGHT_DATA_WIDTH - 1}, index >> ${LIGHT_DATA_WIDTH_SHIFT}), 0);
}

                                                                                                                
vec3 localLightBrdf(Surface s, vec3 Ld, vec3 Ls, vec3 radiance, float specularEnergy, float specularScale) {
  float NdotLd = max(dot(s.N, Ld), 0.0);
  float NdotLs = max(dot(s.N, Ls), 0.0);
  vec3 H = normalize(Ls + s.V);
  float NdotH = max(dot(s.N, H), 0.0);
  float VdotH = max(dot(s.V, H), 0.0);
  vec3 F = fresnelSchlick(VdotH, s.f0);
  vec3 specular = distributionGgx(NdotH, s.alpha) * visibilitySmithGgxCorrelated(s.NdotV, max(NdotLs, 1e-4), s.alpha) * F * s.energyCompensation;
  specular *= specularEnergy * specularScale * NdotLs;
  vec3 diffuse = (1.0 - F) * s.diffuseColor * (NdotLd / PI);
  return (diffuse + specular) * radiance;
}

                                                                                          
vec3 sphereRepresentative(vec3 center, vec3 R, float r) {
  vec3 centerToRay = dot(center, R) * R - center;
  return center + centerToRay * clamp(r / max(length(centerToRay), 1e-4), 0.0, 1.0);
}

                                                                                          
float sphereEnergy(float alpha, float r, float d) {
  float alphaPrime = clamp(alpha + r / (2.0 * max(d, 1e-3)), 0.0, 1.0);
  float ratio = alpha / max(alphaPrime, 1e-4);
  return ratio * ratio;
}

                                                                                                              
float localShadowVisibility(int slot, vec3 P, vec3 N, float distanceToLight, float softnessTexels, float normalBiasTexels, float strength) {
  int base = LOCAL_SHADOW_SLOTS_OFFSET + slot * LOCAL_SHADOW_SLOT_TEXELS;
  vec4 meta = localLightTexel(base + 4);
  mat4 toShadow = mat4(localLightTexel(base), localLightTexel(base + 1), localLightTexel(base + 2), localLightTexel(base + 3));
  vec3 offset = N * (normalBiasTexels * meta.y * distanceToLight);
  vec4 sc = toShadow * vec4(P + offset, 1.0);
  if (sc.w <= 0.0) return 1.0;
  vec3 uvz = sc.xyz / sc.w;
  if (any(lessThan(uvz.xy, vec2(0.0))) || any(greaterThan(uvz.xy, vec2(1.0))) || uvz.z >= 1.0) return 1.0;
  float layer = meta.x;
  float radius = softnessTexels * u_localShadowTexel;
  float sum = texture(u_localShadowAtlas, vec4(uvz.xy, layer, uvz.z));
  sum += texture(u_localShadowAtlas, vec4(uvz.xy + vec2(radius, 0.0), layer, uvz.z));
  sum += texture(u_localShadowAtlas, vec4(uvz.xy + vec2(-radius, 0.0), layer, uvz.z));
  sum += texture(u_localShadowAtlas, vec4(uvz.xy + vec2(0.0, radius), layer, uvz.z));
  sum += texture(u_localShadowAtlas, vec4(uvz.xy + vec2(0.0, -radius), layer, uvz.z));
  float diagonal = radius * 0.7071;
  sum += texture(u_localShadowAtlas, vec4(uvz.xy + vec2(diagonal, diagonal), layer, uvz.z));
  sum += texture(u_localShadowAtlas, vec4(uvz.xy + vec2(-diagonal, diagonal), layer, uvz.z));
  sum += texture(u_localShadowAtlas, vec4(uvz.xy + vec2(diagonal, -diagonal), layer, uvz.z));
  sum += texture(u_localShadowAtlas, vec4(uvz.xy + vec2(-diagonal, -diagonal), layer, uvz.z));
  return mix(1.0, sum / 9.0, strength);
}

                                                                                                               
int localShadowFace(vec3 l) {
  vec3 a = abs(l);
  if (a.x >= a.y && a.x >= a.z) return l.x > 0.0 ? 0 : 1;
  if (a.y >= a.z) return l.y > 0.0 ? 2 : 3;
  return l.z > 0.0 ? 4 : 5;
}

                                                                                                   
vec3 evaluateLocalLight(int index, Surface s, vec3 P) {
  int base = index * LOCAL_LIGHT_TEXELS;
  vec4 t0 = localLightTexel(base);
  vec3 toCenter = t0.xyz - P;
  float range = t0.w;
  float centerDistance2 = dot(toCenter, toCenter);

  vec4 t1 = localLightTexel(base + 1);
  int type = int(t1.w + 0.5);
  vec4 t2 = localLightTexel(base + 2);
  vec4 t3 = localLightTexel(base + 3);
  vec4 t4 = localLightTexel(base + 4);
  vec4 t5 = localLightTexel(base + 5);
  vec4 t6 = localLightTexel(base + 6);
  vec3 forward = t2.xyz;
  vec3 right = t3.xyz;
  vec3 up = t4.xyz;
  float sourceRadius = t3.w;
  vec3 R = reflect(-s.V, s.N);

  vec3 Ld;
  vec3 Ls;
  float d;
  float specularEnergy;
  float shaping = 1.0;

  if (type <= 1) {
                                                                
    if (centerDistance2 >= range * range) return vec3(0.0);
    d = sqrt(centerDistance2);
    Ld = toCenter / d;
    Ls = normalize(sphereRepresentative(toCenter, R, sourceRadius));
    specularEnergy = sphereEnergy(s.alpha, sourceRadius, d);
    if (type == 1) {
      float cone = clamp(dot(-Ld, forward) * t5.x + t5.y, 0.0, 1.0);
      shaping = cone * cone;
      if (shaping <= 0.0) return vec3(0.0);
    }
  } else if (type == 4) {
                                                                                                                       
    vec3 a = toCenter - right * t5.z;
    vec3 ab = right * (2.0 * t5.z);
    float abLength2 = max(dot(ab, ab), 1e-6);
    float tNear = clamp(-dot(a, ab) / abLength2, 0.0, 1.0);
    vec3 closest = a + ab * tNear;
    d = length(closest);
    if (d >= range) return vec3(0.0);
    Ld = closest / d;
    float dotRA = dot(R, a);
    float dotRAB = dot(R, ab);
    float tRay = clamp((dotRA * dotRAB - dot(a, ab)) / max(abLength2 - dotRAB * dotRAB, 1e-5), 0.0, 1.0);
    vec3 onLine = a + ab * tRay;
    Ls = normalize(sphereRepresentative(onLine, R, sourceRadius));
    specularEnergy = sphereEnergy(s.alpha, max(sourceRadius, t5.z * 0.25), d);
  } else {
                                                                                               
    float facing = dot(-toCenter, forward);
    if (facing < 0.0) {
      if (t6.x < 0.5) return vec3(0.0);
      forward = -forward;
    }
    vec2 local = vec2(dot(-toCenter, right), dot(-toCenter, up));
    vec2 nearest = type == 2 ? clamp(local, -t5.zw, t5.zw) : local * min(1.0, t5.z / max(length(local), 1e-4));
    vec3 closest = toCenter + right * nearest.x + up * nearest.y;
    d = length(closest);
    if (d >= range) return vec3(0.0);
    Ld = closest / d;
                                                                                
    shaping = clamp(dot(-Ld, forward), 0.0, 1.0);
    shaping = sqrt(shaping);
    float denom = dot(R, forward);
    vec3 representative = closest;
    if (denom < -1e-4) {
      vec3 hit = R * (dot(toCenter, forward) / denom);
      vec2 h = vec2(dot(hit - toCenter, right), dot(hit - toCenter, up));
      vec2 hc = type == 2 ? clamp(h, -t5.zw, t5.zw) : h * min(1.0, t5.z / max(length(h), 1e-4));
      representative = toCenter + right * hc.x + up * hc.y;
    }
    Ls = normalize(representative);
    float extent = type == 2 ? min(t5.z, t5.w) : t5.z;
    specularEnergy = sphereEnergy(s.alpha, extent, max(length(representative), 1e-3));
  }

                                                                                         
  float window = clamp(1.0 - pow(d / range, 4.0), 0.0, 1.0);
  float d2 = max(d * d, 1e-4) + sourceRadius * sourceRadius;
  float attenuation = window * window / pow(d2, t2.w * 0.5);
  vec3 radiance = t1.rgb * (attenuation * shaping);
  if (max(radiance.r, max(radiance.g, radiance.b)) < 1e-5) return vec3(0.0);

  int slot = int(floor(t6.y + 0.5));
  if (slot >= 0) {
    vec4 t7 = localLightTexel(base + 7);
    int face = 0;
    if (t6.w > 0.5) face = localShadowFace(vec3(dot(-toCenter, right), dot(-toCenter, up), dot(-toCenter, t2.xyz)));
    radiance *= localShadowVisibility(slot + face, P, s.N, sqrt(centerDistance2), t6.z, t7.x, t7.y);
  }

  return localLightBrdf(s, Ld, Ls, radiance, specularEnergy, t4.w);
}

                                                                                                     
vec3 localLightsContributionAt(Surface s, vec3 P, vec2 fragCoord) {
  if (u_localLightCount == 0) return vec3(0.0);
  ivec2 tile = ivec2(max(fragCoord, vec2(0.0))) / u_localLightTiles.x;
  tile.x = min(tile.x, u_localLightTiles.y - 1);
  vec4 mask = localLightTexel(u_localLightTiles.z + tile.y * u_localLightTiles.y + tile.x);
  vec3 color = vec3(0.0);
  for (int channel = 0; channel < 4; channel++) {
    float packed = channel == 0 ? mask.x : channel == 1 ? mask.y : channel == 2 ? mask.z : mask.w;
    highp uint bits = uint(packed + 0.5);
    int first = channel * LOCAL_TILE_BITS;
    for (int bit = 0; bit < LOCAL_TILE_BITS; bit++) {
      if (bits == 0u) break;
      if ((bits & 1u) != 0u) color += evaluateLocalLight(first + bit, s, P);
      bits >>= 1u;
    }
  }
  return color;
}

#ifdef SCENE_LIGHTING_VERTEX_STAGE
                                                                                                      
vec3 localLightsContributionClip(Surface s, vec3 P, vec4 clipPosition) {
  if (u_localLightCount == 0 || clipPosition.w <= 0.0) return vec3(0.0);
  vec2 fragCoord = (clipPosition.xy / clipPosition.w * 0.5 + 0.5) * u_localLightViewport;
  return localLightsContributionAt(s, P, fragCoord);
}
#else
                                                          
vec3 localLightsContribution(Surface s, vec3 P) {
  return localLightsContributionAt(s, P, gl_FragCoord.xy);
}
#endif
`;
