import { HDR_ENCODING_CHUNK, HDR_RANGE_SCENE } from '../chunks/hdr-encoding.glsl';
export const DOF_COC_CHUNK = `
                                                                                             
uniform vec4 u_cocParams;
                                                         
uniform vec2 u_depthParams;

float linearDepth(float sampled) {
  float ndc = sampled * 2.0 - 1.0;
  float n = u_depthParams.x;
  float f = u_depthParams.y;
  return 2.0 * n * f / (f + n - ndc * (f - n));
}

                                                                                                                                 
float cocRadius(float depth) {
  return clamp(u_cocParams.y * (depth - u_cocParams.x) / max(depth, 1e-4), -u_cocParams.z, u_cocParams.z);
}
`;
export const DOF_PREFILTER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_color;
uniform sampler2D u_depth;
uniform vec2 u_sourceTexel;
uniform vec2 u_targetTexel;

${HDR_ENCODING_CHUNK}
${DOF_COC_CHUNK}

out vec4 fragColor;

vec3 fetchHdr(vec2 uv) {
  return decodeHdr(texture(u_color, uv), ${HDR_RANGE_SCENE}.0).rgb;
}

void main() {
  vec2 uv = gl_FragCoord.xy * u_targetTexel;
                                                                                 
  vec4 duv = u_sourceTexel.xyxy * vec4(0.5, 0.5, -0.5, 0.0);
  vec3 c0 = fetchHdr(uv - duv.xy);
  vec3 c1 = fetchHdr(uv - duv.zy);
  vec3 c2 = fetchHdr(uv + duv.zy);
  vec3 c3 = fetchHdr(uv + duv.xy);

  vec4 cocs = vec4(
    cocRadius(linearDepth(texture(u_depth, uv - duv.xy).r)),
    cocRadius(linearDepth(texture(u_depth, uv - duv.zy).r)),
    cocRadius(linearDepth(texture(u_depth, uv + duv.zy).r)),
    cocRadius(linearDepth(texture(u_depth, uv + duv.xy).r))
  );
  float cocMin = min(min(cocs.x, cocs.y), min(cocs.z, cocs.w));
  float cocMax = max(max(cocs.x, cocs.y), max(cocs.z, cocs.w));
                                                                                                
  float coc = (-cocMin > cocMax) ? cocMin : cocMax;

  vec3 average = (c0 + c1 + c2 + c3) * 0.25;
                                                                                                                
  average *= smoothstep(0.0, u_targetTexel.y * 2.0, abs(coc));

  fragColor = vec4(encodeHdr(average, 1.0, ${HDR_RANGE_SCENE}.0).rgb, coc / u_cocParams.z * 0.5 + 0.5);
}
`;
export const DOF_BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;

#ifndef DOF_TAPS
#define DOF_TAPS 24
#endif

uniform sampler2D u_source;
uniform vec2 u_texel;
                                               
uniform float u_maxCoc;
                                                                         
uniform float u_rcpAspect;

${HDR_ENCODING_CHUNK}

out vec4 fragColor;

const float GOLDEN_ANGLE = 2.399963;
const float PI = 3.14159265;

void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  vec4 center = texture(u_source, uv);
  float centerCoc = (center.a * 2.0 - 1.0) * u_maxCoc;
  float margin = u_texel.y * 2.0;

  vec4 background = vec4(0.0);
  vec4 foreground = vec4(0.0);
  for (int i = 0; i < DOF_TAPS; i++) {
    float index = float(i);
    float radius = sqrt((index + 0.5) / float(DOF_TAPS));
    float angle = index * GOLDEN_ANGLE;
    vec2 displacement = vec2(cos(angle), sin(angle)) * radius * u_maxCoc;
    float tapDistance = length(displacement);
    vec4 tap = texture(u_source, uv + vec2(displacement.x * u_rcpAspect, displacement.y));
    float tapCoc = (tap.a * 2.0 - 1.0) * u_maxCoc;
    vec3 tapColor = decodeHdr(tap, ${HDR_RANGE_SCENE}.0).rgb;

                                                                                                 
    float backgroundCoc = max(min(centerCoc, tapCoc), 0.0);
    float backgroundWeight = clamp((backgroundCoc - tapDistance + margin) / margin, 0.0, 1.0);
                                                                                                   
    float foregroundWeight = clamp((-tapCoc - tapDistance + margin) / margin, 0.0, 1.0);
                                                                                                   
    foregroundWeight *= step(u_texel.y, -tapCoc);

    background += vec4(tapColor, 1.0) * backgroundWeight;
    foreground += vec4(tapColor, 1.0) * foregroundWeight;
  }

  background.rgb /= background.a + (background.a == 0.0 ? 1.0 : 0.0);
  foreground.rgb /= foreground.a + (foreground.a == 0.0 ? 1.0 : 0.0);
                                                                       
  float alpha = clamp(foreground.a * PI / float(DOF_TAPS), 0.0, 1.0);
  vec3 color = mix(background.rgb, foreground.rgb, alpha);
  fragColor = vec4(encodeHdr(color, 1.0, ${HDR_RANGE_SCENE}.0).rgb, alpha);
}
`;
