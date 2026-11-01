import { HDR_ENCODING_CHUNK, HDR_RANGE_SCENE } from '../chunks/hdr-encoding.glsl';
const BLOOM_COMMON = `
uniform sampler2D u_source;
                                            
uniform vec2 u_sourceTexel;
                                           
uniform vec2 u_targetTexel;

${HDR_ENCODING_CHUNK}

vec3 fetchHdr(vec2 uv) {
  return decodeHdr(texture(u_source, uv), ${HDR_RANGE_SCENE}.0).rgb;
}
`;
const BLOOM_TAPS = `
  vec3 A = fetchHdr(uv + u_sourceTexel * vec2(-1.0, -1.0));
  vec3 B = fetchHdr(uv + u_sourceTexel * vec2(0.0, -1.0));
  vec3 C = fetchHdr(uv + u_sourceTexel * vec2(1.0, -1.0));
  vec3 D = fetchHdr(uv + u_sourceTexel * vec2(-0.5, -0.5));
  vec3 E = fetchHdr(uv + u_sourceTexel * vec2(0.5, -0.5));
  vec3 F = fetchHdr(uv + u_sourceTexel * vec2(-1.0, 0.0));
  vec3 G = fetchHdr(uv);
  vec3 H = fetchHdr(uv + u_sourceTexel * vec2(1.0, 0.0));
  vec3 I = fetchHdr(uv + u_sourceTexel * vec2(-0.5, 0.5));
  vec3 J = fetchHdr(uv + u_sourceTexel * vec2(0.5, 0.5));
  vec3 K = fetchHdr(uv + u_sourceTexel * vec2(-1.0, 1.0));
  vec3 L = fetchHdr(uv + u_sourceTexel * vec2(0.0, 1.0));
  vec3 M = fetchHdr(uv + u_sourceTexel * vec2(1.0, 1.0));
`;
export const BLOOM_PREFILTER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_threshold;
uniform float u_knee;

${BLOOM_COMMON}

out vec4 fragColor;

vec3 karisAverage(vec3 a, vec3 b, vec3 c, vec3 d) {
  const vec3 luma = vec3(0.2126, 0.7152, 0.0722);
  float wa = 1.0 / (1.0 + dot(a, luma));
  float wb = 1.0 / (1.0 + dot(b, luma));
  float wc = 1.0 / (1.0 + dot(c, luma));
  float wd = 1.0 / (1.0 + dot(d, luma));
  return (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
}

void main() {
  vec2 uv = gl_FragCoord.xy * u_targetTexel;
  ${BLOOM_TAPS}
  vec3 color = karisAverage(D, E, I, J) * 0.5;
  color += (karisAverage(A, B, F, G) + karisAverage(B, C, G, H) + karisAverage(F, G, K, L) + karisAverage(G, H, L, M)) * 0.125;

                                                                                                                 
  float brightness = max(color.r, max(color.g, color.b));
  float soft = clamp(brightness - u_threshold + u_knee, 0.0, 2.0 * u_knee);
  soft = soft * soft / (4.0 * u_knee + 1e-4);
  float contribution = max(soft, brightness - u_threshold) / max(brightness, 1e-4);
  fragColor = encodeHdr(max(color * contribution, vec3(0.0)), 1.0, ${HDR_RANGE_SCENE}.0);
}
`;
export const BLOOM_DOWNSAMPLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

${BLOOM_COMMON}

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy * u_targetTexel;
  ${BLOOM_TAPS}
  vec3 color = (D + E + I + J) * 0.125;
  color += (A + B + G + F) * 0.03125;
  color += (B + C + H + G) * 0.03125;
  color += (F + G + L + K) * 0.03125;
  color += (G + H + M + L) * 0.03125;
  fragColor = encodeHdr(color, 1.0, ${HDR_RANGE_SCENE}.0);
}
`;
export const BLOOM_UPSAMPLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_current;
uniform float u_scatter;

${BLOOM_COMMON}

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy * u_targetTexel;
  vec4 d = u_sourceTexel.xyxy * vec4(1.0, 1.0, -1.0, 0.0);
  vec3 blurred = fetchHdr(uv - d.xy);
  blurred += fetchHdr(uv - d.wy) * 2.0;
  blurred += fetchHdr(uv - d.zy);
  blurred += fetchHdr(uv + d.zw) * 2.0;
  blurred += fetchHdr(uv) * 4.0;
  blurred += fetchHdr(uv + d.xw) * 2.0;
  blurred += fetchHdr(uv + d.zy);
  blurred += fetchHdr(uv + d.wy) * 2.0;
  blurred += fetchHdr(uv + d.xy);
  blurred *= 1.0 / 16.0;

  vec3 current = decodeHdr(texelFetch(u_current, ivec2(gl_FragCoord.xy), 0), ${HDR_RANGE_SCENE}.0).rgb;
  fragColor = encodeHdr(mix(current, blurred, u_scatter), 1.0, ${HDR_RANGE_SCENE}.0);
}
`;
