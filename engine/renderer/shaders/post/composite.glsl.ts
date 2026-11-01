import { COLOR_CHUNK } from '../chunks/color.glsl';
import { HDR_ENCODING_CHUNK, HDR_RANGE_SCENE } from '../chunks/hdr-encoding.glsl';
import { NOISE_CHUNK } from '../chunks/noise.glsl';
import { DOF_COC_CHUNK } from './depth-of-field.glsl';
import { TONEMAPPING_CHUNK } from './tonemapping.glsl';
export const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_color;
uniform sampler2D u_depth;
uniform sampler2D u_bloom;
uniform sampler2D u_dof;
                               
uniform vec2 u_texel;
                        
uniform float u_aspect;

                                                                             
uniform vec2 u_distortion;
uniform float u_chromatic;
uniform float u_dofEnabled;
uniform float u_bloomIntensity;
                                            
uniform float u_exposureScale;
                                                               
uniform vec3 u_whiteBalance;
uniform int u_toneMapper;
                                                                                                      
uniform vec4 u_grading;
                                                        
uniform vec3 u_tones;
                                                        
uniform vec3 u_shadowTint;
uniform vec3 u_highlightTint;
                                                     
uniform vec3 u_vignette;
                                                                                      
uniform vec4 u_grain;
uniform float u_compareSplit;

${HDR_ENCODING_CHUNK}
${COLOR_CHUNK}
${NOISE_CHUNK}
${TONEMAPPING_CHUNK}
${DOF_COC_CHUNK}

out vec4 fragColor;

vec3 fetchHdr(vec2 uv) {
  return decodeHdr(texture(u_color, uv), ${HDR_RANGE_SCENE}.0).rgb;
}

                                                                                              
vec2 distortUv(vec2 uv, float k, float scale) {
  vec2 aspect = vec2(u_aspect, 1.0);
  float halfDiagonal = length(0.5 * aspect);
  vec2 centered = (uv - 0.5) * aspect / (scale * halfDiagonal);
  centered *= 1.0 + k * dot(centered, centered);
  return centered * halfDiagonal / aspect + 0.5;
}

                                                              
vec3 whiteBalance(vec3 c) {
  vec3 lms = vec3(
    dot(c, vec3(0.390405, 0.549941, 0.00892632)),
    dot(c, vec3(0.0708416, 0.963172, 0.00135775)),
    dot(c, vec3(0.0231082, 0.128021, 0.936245))
  );
  lms *= u_whiteBalance;
  return vec3(
    dot(lms, vec3(2.85847, -1.62879, -0.0248910)),
    dot(lms, vec3(-0.210182, 1.15820, 0.000324281)),
    dot(lms, vec3(-0.0418120, -0.118169, 1.06867))
  );
}

vec3 softLight(vec3 base, vec3 blend) {
  return (1.0 - 2.0 * blend) * base * base + 2.0 * blend * base;
}

                                                                                                              
vec3 grade(vec3 c, float fx) {
                                                                              
  float lum = dot(c, LUMA_709);
  float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(lum), c, 1.0 + u_grading.z * fx * (1.0 - chroma));
  lum = dot(c, LUMA_709);
  c = mix(vec3(lum), c, 1.0 + u_grading.y * fx);

                                                                                                     
  vec3 g = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
  g = (g - 0.5) * (1.0 + u_grading.x * 0.8 * fx) + 0.5;
  g *= 1.0 + u_tones.z * 0.3 * fx;
  g += u_tones.x * 0.15 * fx * (1.0 - g);
  g = pow(max(g, vec3(0.0)), vec3(1.0 / (1.0 + u_tones.y * 0.6 * fx)));

                                                                                           
  float t = smoothstep(0.0, 1.0, dot(clamp(g, 0.0, 1.0), LUMA_709) - u_grading.w * 0.5);
  vec3 tone = mix(vec3(0.5), mix(u_shadowTint, u_highlightTint, t), fx);
  g = softLight(clamp(g, 0.0, 1.0), tone);
  return pow(max(g, vec3(0.0)), vec3(2.2));
}

float vignetteFactor(vec2 uv, float fx) {
  vec2 d = abs(uv - 0.5) * u_vignette.x * 3.0 * fx;
  d.x *= mix(1.0, u_aspect, u_vignette.z);
  return pow(clamp(1.0 - dot(d, d), 0.0, 1.0), mix(1.0, 5.0, u_vignette.y));
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

                                                                                                          
float filmGrain(vec2 pixel) {
  vec2 cell = floor(pixel / max(u_grain.y, 1.0));
  vec2 seed = vec2(fract(u_grain.w * 0.731) * 977.0, fract(u_grain.w * 0.419) * 613.0);
  return hash21(cell + seed) + hash21(cell * 1.37 + seed.yx + 19.0) - 1.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  float fx = uv.x >= u_compareSplit ? 1.0 : 0.0;

                        
  vec2 sampleUv = uv;
  float k = -u_distortion.x * fx;
  if (k != 0.0) sampleUv = clamp(distortUv(uv, k, u_distortion.y), u_texel, 1.0 - u_texel);

  vec3 hdr;
  float chromatic = u_chromatic * fx;
  if (chromatic > 0.0) {
    vec2 toCenter = sampleUv - 0.5;
    vec2 shift = toCenter * dot(toCenter, toCenter) * chromatic * 0.06;
    hdr = vec3(fetchHdr(sampleUv + shift).r, fetchHdr(sampleUv).g, fetchHdr(sampleUv - shift).b);
  } else {
    hdr = fetchHdr(sampleUv);
  }

  if (u_dofEnabled * fx > 0.5) {
    vec4 dof = texture(u_dof, sampleUv);
    float coc = cocRadius(linearDepth(texture(u_depth, sampleUv).r));
                                                                                                           
    float farField = smoothstep(u_texel.y * 2.0, u_texel.y * 4.0, coc);
    vec3 dofColor = decodeHdr(dof, ${HDR_RANGE_SCENE}.0).rgb;
    hdr = mix(hdr, dofColor, farField + dof.a - farField * dof.a);
  }

  float bloom = u_bloomIntensity * fx;
  if (bloom > 0.0) hdr += decodeHdr(texture(u_bloom, sampleUv), ${HDR_RANGE_SCENE}.0).rgb * bloom;

                         
  hdr *= mix(1.0, u_exposureScale, fx);
  hdr = mix(hdr, whiteBalance(hdr), fx);
  vec3 ldr = applyToneMapper(max(hdr, vec3(0.0)), fx > 0.5 ? u_toneMapper : 0);

                              
  ldr = grade(ldr, fx);
  ldr *= vignetteFactor(uv, fx);
  vec3 srgb = linearToSrgb(clamp(ldr, 0.0, 1.0));

  float grain = u_grain.x * fx;
  if (grain > 0.0) {
    float lum = dot(srgb, LUMA_709);
    srgb += filmGrain(gl_FragCoord.xy) * grain * 0.2 * (1.0 - u_grain.z * lum);
  }
  srgb += (interleavedGradientNoise(gl_FragCoord.xy) - 0.5) / 255.0;

  if (u_compareSplit >= 0.0 && abs(uv.x - u_compareSplit) < u_texel.x) srgb = vec3(1.0);
  fragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;
