import { COLOR_CHUNK } from './chunks/color.glsl';
const SMAA_THRESHOLD = '0.1';
export const SMAA_EDGES_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_color;
uniform vec2 u_texel;

out vec4 fragColor;

float colorDelta(vec3 a, vec3 b) {
  vec3 t = abs(a - b);
  return max(max(t.r, t.g), t.b);
}

void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  vec2 threshold = vec2(${SMAA_THRESHOLD});

  vec3 C = texture(u_color, uv).rgb;
  vec3 Cleft = texture(u_color, uv + u_texel * vec2(-1.0, 0.0)).rgb;
  vec3 Ctop = texture(u_color, uv + u_texel * vec2(0.0, 1.0)).rgb;
  vec4 delta;
  delta.x = colorDelta(C, Cleft);
  delta.y = colorDelta(C, Ctop);
  vec2 edges = step(threshold, delta.xy);
  if (dot(edges, vec2(1.0)) == 0.0) discard;

  vec3 Cright = texture(u_color, uv + u_texel * vec2(1.0, 0.0)).rgb;
  vec3 Cbottom = texture(u_color, uv + u_texel * vec2(0.0, -1.0)).rgb;
  delta.z = colorDelta(C, Cright);
  delta.w = colorDelta(C, Cbottom);
  float maxDelta = max(max(max(delta.x, delta.y), delta.z), delta.w);

  vec3 Cleftleft = texture(u_color, uv + u_texel * vec2(-2.0, 0.0)).rgb;
  vec3 Ctoptop = texture(u_color, uv + u_texel * vec2(0.0, 2.0)).rgb;
  delta.z = colorDelta(C, Cleftleft);
  delta.w = colorDelta(C, Ctoptop);
  maxDelta = max(max(maxDelta, delta.z), delta.w);


  edges.xy *= step(0.5 * maxDelta, delta.xy);
  fragColor = vec4(edges, 0.0, 1.0);
}
`;
export const SMAA_WEIGHTS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

#ifndef SMAA_MAX_SEARCH_STEPS
#define SMAA_MAX_SEARCH_STEPS 16
#endif
#define SMAA_AREATEX_MAX_DISTANCE 16.0
#define SMAA_AREATEX_PIXEL_SIZE (1.0 / vec2(160.0, 560.0))
#define SMAA_AREATEX_SUBTEX_SIZE (1.0 / 7.0)

uniform sampler2D u_edges;
uniform sampler2D u_area;
uniform sampler2D u_search;
uniform vec2 u_texel;

out vec4 fragColor;

float searchLength(vec2 e, float bias, float scale) {
  e.r = bias + e.r * scale;
  return 255.0 * textureLod(u_search, e, 0.0).r;
}

float searchXLeft(vec2 texcoord, float end) {
  vec2 e = vec2(0.0, 1.0);
  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
    e = textureLod(u_edges, texcoord, 0.0).rg;
    texcoord -= vec2(2.0, 0.0) * u_texel;
    if (!(texcoord.x > end && e.g > 0.8281 && e.r == 0.0)) break;
  }
  texcoord.x += 0.25 * u_texel.x;
  texcoord.x += u_texel.x;
  texcoord.x += 2.0 * u_texel.x;
  texcoord.x -= u_texel.x * searchLength(e, 0.0, 0.5);
  return texcoord.x;
}

float searchXRight(vec2 texcoord, float end) {
  vec2 e = vec2(0.0, 1.0);
  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
    e = textureLod(u_edges, texcoord, 0.0).rg;
    texcoord += vec2(2.0, 0.0) * u_texel;
    if (!(texcoord.x < end && e.g > 0.8281 && e.r == 0.0)) break;
  }
  texcoord.x -= 0.25 * u_texel.x;
  texcoord.x -= u_texel.x;
  texcoord.x -= 2.0 * u_texel.x;
  texcoord.x += u_texel.x * searchLength(e, 0.5, 0.5);
  return texcoord.x;
}

float searchYUp(vec2 texcoord, float end) {
  vec2 e = vec2(1.0, 0.0);
  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
    e = textureLod(u_edges, texcoord, 0.0).rg;
    texcoord += vec2(0.0, 2.0) * u_texel;
    if (!(texcoord.y > end && e.r > 0.8281 && e.g == 0.0)) break;
  }
  texcoord.y -= 0.25 * u_texel.y;
  texcoord.y -= u_texel.y;
  texcoord.y -= 2.0 * u_texel.y;
  texcoord.y += u_texel.y * searchLength(e.gr, 0.0, 0.5);
  return texcoord.y;
}

float searchYDown(vec2 texcoord, float end) {
  vec2 e = vec2(1.0, 0.0);
  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
    e = textureLod(u_edges, texcoord, 0.0).rg;
    texcoord -= vec2(0.0, 2.0) * u_texel;
    if (!(texcoord.y < end && e.r > 0.8281 && e.g == 0.0)) break;
  }
  texcoord.y += 0.25 * u_texel.y;
  texcoord.y += u_texel.y;
  texcoord.y += 2.0 * u_texel.y;
  texcoord.y -= u_texel.y * searchLength(e.gr, 0.5, 0.5);
  return texcoord.y;
}

vec2 area(vec2 dist, float e1, float e2) {

  vec2 texcoord = SMAA_AREATEX_MAX_DISTANCE * round(4.0 * vec2(e1, e2)) + dist;
  texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + 0.5 * SMAA_AREATEX_PIXEL_SIZE;
  return textureLod(u_area, texcoord, 0.0).rg;
}

void main() {
  vec2 texcoord = gl_FragCoord.xy * u_texel;
  vec2 pixcoord = gl_FragCoord.xy;

  vec4 offset0 = texcoord.xyxy + u_texel.xyxy * vec4(-0.25, 0.125, 1.25, 0.125);
  vec4 offset1 = texcoord.xyxy + u_texel.xyxy * vec4(-0.125, 0.25, -0.125, -1.25);
  vec4 offset2 = vec4(offset0.xz, offset1.yw) + vec4(-2.0, 2.0, -2.0, 2.0) * u_texel.xxyy * float(SMAA_MAX_SEARCH_STEPS);

  vec4 weights = vec4(0.0);
  vec2 e = texture(u_edges, texcoord).rg;

  if (e.g > 0.0) {

    vec2 d;
    vec2 coords;
    coords.x = searchXLeft(offset0.xy, offset2.x);
    coords.y = offset1.y;
    d.x = coords.x;
    float e1 = textureLod(u_edges, coords, 0.0).r;
    coords.x = searchXRight(offset0.zw, offset2.y);
    d.y = coords.x;
    d = d / u_texel.x - pixcoord.x;
    vec2 sqrtD = sqrt(abs(d));
    coords.y -= u_texel.y;
    float e2 = textureLod(u_edges, coords + vec2(1.0, 0.0) * u_texel, 0.0).r;
    weights.rg = area(sqrtD, e1, e2);
  }

  if (e.r > 0.0) {

    vec2 d;
    vec2 coords;
    coords.y = searchYUp(offset1.xy, offset2.z);
    coords.x = offset0.x;
    d.x = coords.y;
    float e1 = textureLod(u_edges, coords, 0.0).g;
    coords.y = searchYDown(offset1.zw, offset2.w);
    d.y = coords.y;
    d = d / u_texel.y - pixcoord.y;
    vec2 sqrtD = sqrt(abs(d));
    coords.y -= u_texel.y;
    float e2 = textureLod(u_edges, coords + vec2(0.0, 1.0) * u_texel, 0.0).g;
    weights.ba = area(sqrtD, e1, e2);
  }

  fragColor = weights;
}
`;
export const SMAA_BLEND_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_color;
uniform sampler2D u_weights;
uniform vec2 u_texel;

${COLOR_CHUNK}

out vec4 fragColor;

void main() {
  vec2 texcoord = gl_FragCoord.xy * u_texel;
  vec4 a;
  a.xz = texture(u_weights, texcoord).xz;
  a.y = texture(u_weights, texcoord + u_texel * vec2(0.0, -1.0)).g;
  a.w = texture(u_weights, texcoord + u_texel * vec2(1.0, 0.0)).a;

  if (dot(a, vec4(1.0)) < 1e-5) {
    fragColor = vec4(textureLod(u_color, texcoord, 0.0).rgb, 1.0);
    return;
  }


  vec2 offset;
  offset.x = a.a > a.b ? a.a : -a.b;
  offset.y = a.g > a.r ? -a.g : a.r;
  if (abs(offset.x) > abs(offset.y)) offset.y = 0.0;
  else offset.x = 0.0;

  vec3 C = textureLod(u_color, texcoord, 0.0).rgb;
  vec3 Cop = textureLod(u_color, texcoord + sign(offset) * u_texel, 0.0).rgb;
  float s = max(abs(offset.x), abs(offset.y));

  vec3 mixed = mix(srgbToLinear(C), srgbToLinear(Cop), s);
  fragColor = vec4(linearToSrgb(mixed), 1.0);
}
`;
export const BLIT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_color;

out vec4 fragColor;

void main() {
  fragColor = vec4(texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb, 1.0);
}
`;
