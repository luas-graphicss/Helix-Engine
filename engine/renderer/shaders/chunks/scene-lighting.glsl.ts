import { BRDF_CHUNK } from './brdf.glsl';
import { COLOR_CHUNK } from './color.glsl';
import { HDR_ENCODING_CHUNK, HDR_RANGE_LIGHTING } from './hdr-encoding.glsl';
import { SHADOW_SAMPLING_CHUNK } from './shadow-sampling.glsl';
import { SKY_LIGHTING_TEXEL } from '../sky/atmosphere.glsl';
export const SCENE_LIGHTING_CHUNK = `
uniform vec3 u_cameraPosition;
uniform float u_exposure;

uniform vec3 u_sunDirection;
uniform vec3 u_sunRadiance;
uniform vec3 u_moonDirection;
uniform vec3 u_moonRadiance;
uniform vec3 u_skyIrradiance;
uniform vec3 u_groundIrradiance;
uniform float u_shadowEnabled;
 
uniform float u_shadowOnMoon;

uniform sampler2D u_skyLightingLut;
uniform float u_skyLightingEnabled;
uniform sampler2D u_cloudShadowMap;
 
uniform vec4 u_cloudShadowRegion;
uniform float u_cloudShadowEnabled;
 
uniform float u_fogDensity;

${BRDF_CHUNK}
${SHADOW_SAMPLING_CHUNK}
${HDR_ENCODING_CHUNK}
${COLOR_CHUNK}

const vec3 SELECTION_TINT = vec3(0.98, 0.62, 0.12);

struct Surface {
  vec3 N;
  vec3 V;
  float NdotV;
  float roughness;
  float alpha;
  vec3 f0;
  vec3 diffuseColor;
};

Surface makeSurface(vec3 N, vec3 worldPosition, vec3 baseColor, float roughness, float metallic) {
  Surface s;
  s.N = N;
  s.V = normalize(u_cameraPosition - worldPosition);
  s.NdotV = max(dot(s.N, s.V), 1e-4);
  s.roughness = clamp(roughness, 0.045, 1.0);
  s.alpha = s.roughness * s.roughness;
  s.f0 = mix(vec3(0.04), baseColor, metallic);
  s.diffuseColor = baseColor * (1.0 - metallic);
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
  vec3 specular = distributionGgx(NdotH, s.alpha) * visibilitySmithGgxCorrelated(s.NdotV, NdotL, s.alpha) * F;
  vec3 diffuse = (1.0 - F) * s.diffuseColor / PI;
  return (diffuse + specular) * radiance * (NdotL * visibility);
}

 
float cloudShadow(vec3 worldPos, vec3 L) {
  if (u_cloudShadowEnabled < 0.5) return 1.0;
  float t = (u_cloudShadowRegion.w - worldPos.y) / max(L.y, 0.05);
  vec2 hit = worldPos.xz + L.xz * t;
  vec2 uv = (hit - u_cloudShadowRegion.xy) * u_cloudShadowRegion.z + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
  return texture(u_cloudShadowMap, uv).r;
}

const float FOG_MAX = 0.92;






vec3 aerialPerspective(vec3 color, vec3 worldPosition, vec3 skyIrradiance, vec3 sunRadiance) {
  if (u_fogDensity <= 0.0) return color;
  vec3 toSurface = worldPosition - u_cameraPosition;
  float dist = length(toSurface);
  vec3 viewDir = toSurface / max(dist, 1e-4);
  float amount = min(1.0 - exp(-dist * u_fogDensity), FOG_MAX);
   
  float sunForward = pow(max(dot(viewDir, u_sunDirection), 0.0), 8.0);
  vec3 fogColor = skyIrradiance * 0.8 + sunRadiance * (0.02 * sunForward);
  return mix(color, fogColor, amount);
}






vec3 shadeSurface(Surface s, vec3 worldPosition, vec3 positionDx, vec3 positionDy, float occlusion, vec3 emissive, float receiveShadows) {
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
  vec3 shadowLight = shadowOnMoon ? u_moonDirection : u_sunDirection;
  vec3 shadowRadiance = shadowOnMoon ? moonRadiance : sunRadiance;
  float shadowNdotL = dot(s.N, shadowLight);
  float visibility = 1.0;
  if (shadowNdotL > 0.0 && any(greaterThan(shadowRadiance, vec3(0.0)))) {
    if (u_shadowEnabled * receiveShadows > 0.5) {
      visibility = sampleDirectionalShadow(worldPosition, s.N, shadowLight, shadowNdotL, positionDx, positionDy);
    }
    visibility *= cloudShadow(worldPosition, shadowLight);
  }

  vec3 color = vec3(0.0);
  if (any(greaterThan(sunRadiance, vec3(0.0)))) {
    color += directLight(s, u_sunDirection, sunRadiance, shadowOnMoon ? 1.0 : visibility);
  }
  if (any(greaterThan(moonRadiance, vec3(0.0)))) {
    color += directLight(s, u_moonDirection, moonRadiance, shadowOnMoon ? visibility : 1.0);
  }

   
  float hemisphere = s.N.y * 0.5 + 0.5;
  vec3 ambientIrradiance = mix(groundIrradiance, skyIrradiance, hemisphere) * occlusion;
  color += s.diffuseColor * ambientIrradiance;
  color += environmentBrdf(s.f0, s.roughness, s.NdotV) * ambientIrradiance;
  return aerialPerspective(color + emissive, worldPosition, skyIrradiance, sunRadiance);
}

 
vec3 finishSurfaceColor(vec3 hdr, Surface s, float selected) {
  vec3 color = linearToSrgb(tonemapAces(hdr * u_exposure));
  float rim = pow(1.0 - s.NdotV, 3.0);
  return mix(color, SELECTION_TINT, selected * rim * 0.9);
}
`;
