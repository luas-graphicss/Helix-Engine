import { HDR_ENCODING_CHUNK, HDR_RANGE_SCENE } from '@/engine/renderer/shaders/chunks/hdr-encoding.glsl';
export const PROBE_PREFILTER_SAMPLES = 24;
export const PROBE_PREFILTER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform samplerCube u_source;
                                           
uniform float u_sourceSize;
uniform int u_face;
uniform float u_roughness;
uniform float u_targetSize;

${HDR_ENCODING_CHUNK}

const float PI = 3.14159265359;
const int SAMPLES = ${PROBE_PREFILTER_SAMPLES};

                                                                                                               
vec3 cubeDirection(int face, vec2 uv) {
  if (face == 0) return vec3(1.0, -uv.y, -uv.x);
  if (face == 1) return vec3(-1.0, -uv.y, uv.x);
  if (face == 2) return vec3(uv.x, 1.0, uv.y);
  if (face == 3) return vec3(uv.x, -1.0, -uv.y);
  if (face == 4) return vec3(uv.x, -uv.y, 1.0);
  return vec3(-uv.x, -uv.y, -1.0);
}

float radicalInverse(uint bits) {
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return float(bits) * 2.3283064365386963e-10;
}

vec3 importanceSampleGgx(vec2 xi, float alpha, vec3 N) {
  float phi = 2.0 * PI * xi.x;
  float cosTheta = sqrt((1.0 - xi.y) / (1.0 + (alpha * alpha - 1.0) * xi.y));
  float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
  vec3 H = vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 T = normalize(cross(up, N));
  vec3 B = cross(N, T);
  return normalize(T * H.x + B * H.y + N * H.z);
}

float distributionGgx(float NdotH, float alpha) {
  float a2 = alpha * alpha;
  float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}

out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy / u_targetSize) * 2.0 - 1.0;
  vec3 N = normalize(cubeDirection(u_face, uv));
  if (u_roughness <= 0.0) {
    fragColor = textureLod(u_source, N, 0.0);
    return;
  }

  float alpha = max(u_roughness * u_roughness, 1e-3);
                                                                                               
  float texelSolidAngle = 4.0 * PI / (6.0 * u_sourceSize * u_sourceSize);
  vec3 sum = vec3(0.0);
  float weight = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    vec2 xi = vec2(float(i) / float(SAMPLES), radicalInverse(uint(i)));
    vec3 H = importanceSampleGgx(xi, alpha, N);
    vec3 L = 2.0 * dot(N, H) * H - N;
    float NdotL = dot(N, L);
    if (NdotL <= 0.0) continue;
    float NdotH = max(dot(N, H), 0.0);
                                                            
    float pdf = distributionGgx(NdotH, alpha) * 0.25 + 1e-5;
    float sampleSolidAngle = 1.0 / (float(SAMPLES) * pdf);
    float lod = clamp(0.5 * log2(sampleSolidAngle / texelSolidAngle) + 1.0, 0.0, 8.0);
    sum += decodeHdr(textureLod(u_source, L, lod), ${HDR_RANGE_SCENE}.0).rgb * NdotL;
    weight += NdotL;
  }
  fragColor = encodeHdr(sum / max(weight, 1e-4), 1.0, ${HDR_RANGE_SCENE}.0);
}
`;
