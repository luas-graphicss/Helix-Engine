export const MYRIAD_HZB_REDUCE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform highp sampler2D u_source;
uniform ivec2 u_sourceSize;

out float fragDepth;

float fetch(ivec2 coord) {
  return texelFetch(u_source, clamp(coord, ivec2(0), u_sourceSize - 1), 0).r;
}

void main() {
  ivec2 s = ivec2(gl_FragCoord.xy) * 2;
  float d = max(max(fetch(s), fetch(s + ivec2(1, 0))), max(fetch(s + ivec2(0, 1)), fetch(s + ivec2(1, 1))));
  bool oddX = (u_sourceSize.x & 1) == 1;
  bool oddY = (u_sourceSize.y & 1) == 1;
  if (oddX) d = max(d, max(fetch(s + ivec2(2, 0)), fetch(s + ivec2(2, 1))));
  if (oddY) d = max(d, max(fetch(s + ivec2(0, 2)), fetch(s + ivec2(1, 2))));
  if (oddX && oddY) d = max(d, fetch(s + ivec2(2, 2)));
  fragDepth = d;
}
`;
export const MYRIAD_HZB_VIEW_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform highp sampler2D u_hzb;
uniform int u_level;
uniform vec2 u_screenSize;
uniform vec2 u_hzbSize;
uniform float u_near;
uniform float u_far;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_screenSize;
  ivec2 levelSize = max(ivec2(u_hzbSize) >> u_level, ivec2(1));
  ivec2 coord = clamp(ivec2(uv * vec2(levelSize)), ivec2(0), levelSize - 1);
  float depth = texelFetch(u_hzb, coord, u_level).r;
  if (depth >= 1.0) {
    fragColor = vec4(0.05, 0.06, 0.08, 1.0);
    return;
  }
  float ndc = depth * 2.0 - 1.0;
  float linear = (2.0 * u_near * u_far) / (u_far + u_near - ndc * (u_far - u_near));
  float shade = exp(-linear * 0.03);
  fragColor = vec4(vec3(shade), 1.0);
}
`;
