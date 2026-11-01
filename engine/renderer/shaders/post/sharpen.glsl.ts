export const SHARPEN_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_color;
                                   
uniform float u_sharpness;

out vec4 fragColor;

vec3 fetchClamped(ivec2 p, ivec2 size) {
  return texelFetch(u_color, clamp(p, ivec2(0), size - 1), 0).rgb;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(u_color, 0);
  vec3 e = fetchClamped(p, size);
  vec3 a = fetchClamped(p + ivec2(0, 1), size);
  vec3 b = fetchClamped(p + ivec2(-1, 0), size);
  vec3 c = fetchClamped(p + ivec2(1, 0), size);
  vec3 d = fetchClamped(p + ivec2(0, -1), size);

  vec3 lowest = min(min(min(a, b), min(c, d)), e);
  vec3 highest = max(max(max(a, b), max(c, d)), e);
                                                                                           
  vec3 amplitude = sqrt(clamp(min(lowest, 1.0 - highest) / max(highest, 1e-4), 0.0, 1.0));
  float peak = -1.0 / mix(8.0, 5.0, u_sharpness);
  vec3 w = amplitude * peak;
  vec3 color = (e + w * (a + b + c + d)) / (1.0 + 4.0 * w);
  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
