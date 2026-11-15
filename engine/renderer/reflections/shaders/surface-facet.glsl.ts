export const SURFACE_FACET_CHUNK = `
const float FACET_UNREACHABLE = 1.0e30;
const float FACET_MIN_FACING = 0.02;
const float FACET_MAX_EXTENT = 0.25;
const float FACET_SLOPE_SLACK = 2.0;
const float FACET_SHELL_THICKNESS = 0.35;
const float FACET_SHELL_GROWTH = 0.04;
const float FACET_MIN_TURN = 1.0e-6;
const float FACET_SEAM_SLACK = 0.5;
const float FACET_SEAM_BIAS = 0.002;

struct SurfaceFacet {
  float depth;
  vec2 slope;
  float extent;
  float thickness;
  vec3 normal;
  bool oriented;
};

vec3 viewRayAt(vec2 pixel) {
  vec2 ndc = pixel / u_sceneSize * 2.0 - 1.0;
  return vec3((ndc + u_projection[2].xy) / vec2(u_projection[0][0], u_projection[1][1]), -1.0);
}

float facetDepthAt(SurfaceFacet facet, vec2 offset) {
  return facet.depth + clamp(dot(facet.slope, offset), -facet.extent, facet.extent);
}

float sceneDepthAt(ivec2 pixel) {
  float bufferDepth = texelFetch(u_sceneDepth, clamp(pixel, ivec2(0), ivec2(u_sceneSize) - 1), 0).r;
  return bufferDepth >= 1.0 ? FACET_UNREACHABLE : -viewZFromDepth(bufferDepth);
}

vec3 sceneNormalAt(ivec2 pixel) {
  SurfaceSample surface = decodeSurfaceBuffer(texelFetch(u_surface, clamp(pixel, ivec2(0), ivec2(u_sceneSize) - 1), 0));
  return surface.valid ? surface.N : vec3(0.0);
}

float gentlerSlope(float before, float center, float after) {
  float backward = center - before;
  float onward = after - center;
  return abs(backward) < abs(onward) ? backward : onward;
}

float gentlerTurn(vec3 before, vec3 center, vec3 after) {
  return min(length(center - before), length(after - center));
}

SurfaceFacet readSurfaceFacet(ivec2 pixel) {
  SurfaceFacet facet;
  facet.depth = sceneDepthAt(pixel);
  facet.slope = vec2(0.0);
  facet.extent = 0.0;
  facet.thickness = 0.0;
  facet.normal = vec3(0.0);
  facet.oriented = false;
  if (facet.depth >= FACET_UNREACHABLE) return facet;

  facet.thickness = FACET_SHELL_THICKNESS * (1.0 + FACET_SHELL_GROWTH * facet.depth);
  facet.slope = vec2(
    gentlerSlope(sceneDepthAt(pixel - ivec2(1, 0)), facet.depth, sceneDepthAt(pixel + ivec2(1, 0))),
    gentlerSlope(sceneDepthAt(pixel - ivec2(0, 1)), facet.depth, sceneDepthAt(pixel + ivec2(0, 1))));

  SurfaceSample surface = decodeSurfaceBuffer(texelFetch(u_surface, pixel, 0));
  if (surface.valid) {
    facet.normal = mat3(u_view) * surface.N;
    facet.oriented = true;
    float facing = min(dot(facet.normal, viewRayAt(vec2(pixel) + 0.5)), -FACET_MIN_FACING);
    vec2 rayStep = 2.0 / (u_sceneSize * vec2(u_projection[0][0], u_projection[1][1]));
    vec2 steepest = FACET_SLOPE_SLACK * abs(facet.depth * facet.normal.xy * rayStep / facing);
    facet.slope = clamp(facet.slope, -steepest, steepest);
    float turn = length(vec2(
      gentlerTurn(sceneNormalAt(pixel - ivec2(1, 0)), surface.N, sceneNormalAt(pixel + ivec2(1, 0))),
      gentlerTurn(sceneNormalAt(pixel - ivec2(0, 1)), surface.N, sceneNormalAt(pixel + ivec2(0, 1)))));
    float chord = 2.0 * facet.depth * rayStep.y / max(turn, FACET_MIN_TURN);
    facet.thickness = surface.solid ? FACET_UNREACHABLE : min(facet.thickness, chord);
  }
  facet.extent = min(0.5 * (abs(facet.slope.x) + abs(facet.slope.y)), facet.depth * FACET_MAX_EXTENT);
  return facet;
}

vec2 seamlessOffset(SurfaceFacet facet, ivec2 pixel, vec2 offset) {
  ivec2 side = ivec2(sign(offset));
  vec2 neighbor = vec2(sceneDepthAt(pixel + ivec2(side.x, 0)), sceneDepthAt(pixel + ivec2(0, side.y)));
  vec2 expected = facet.depth + facet.slope * vec2(side);
  vec2 seamTolerance = FACET_SEAM_SLACK * abs(facet.slope) + FACET_SEAM_BIAS * facet.depth;
  return offset * step(abs(neighbor - expected), seamTolerance);
}
`;
