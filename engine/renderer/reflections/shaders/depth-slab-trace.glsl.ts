import { SCREEN_RAY_CHUNK } from './screen-ray.glsl';
import { SURFACE_FACET_CHUNK } from './surface-facet.glsl';
export const DEPTH_SLAB_TRACE_CHUNK = `
${SCREEN_RAY_CHUNK}
${SURFACE_FACET_CHUNK}

uniform sampler2D u_depthSlabs;
uniform int u_slabMaxLevel;
uniform float u_traceBudget;
uniform float u_depthQuantum;
uniform float u_farDistance;

const float TRACE_START_TRAVEL = 0.5;
const float TRACE_CELL_BIAS = 0.01;
const float TRACE_MIN_PACE = 1.0e-6;

struct SlabTrace {
  bool hit;
  bool escaped;
  vec2 pixel;
  float depth;
};

SlabTrace traceDepthSlabs(vec3 origin, vec3 direction) {
  SlabTrace trace;
  trace.hit = false;
  trace.escaped = false;
  trace.pixel = vec2(0.0);
  trace.depth = 0.0;

  ScreenRay ray = projectScreenRay(origin, direction, u_farDistance);
  vec2 forward = step(vec2(0.0), ray.pixelStep);
  vec2 heading = forward * 2.0 - 1.0;
  vec2 pace = max(abs(ray.pixelStep), vec2(TRACE_MIN_PACE));
  vec2 screenSize = ray.permuted ? u_sceneSize.yx : u_sceneSize;
  vec2 screenExits = (forward * screenSize - ray.start) * heading / pace;
  float travelLimit = min(ray.extent, min(screenExits.x, screenExits.y));

  float travel = TRACE_START_TRAVEL;
  int level = 0;
  bool occluded = false;
  for (float iteration = 0.0; iteration < u_traceBudget; iteration += 1.0) {
    if (travel >= travelLimit) {
      trace.escaped = !occluded;
      return trace;
    }
    float cellSize = float(1 << level);
    vec2 cell = floor((ray.start + ray.pixelStep * travel + heading * TRACE_CELL_BIAS) / cellSize);
    vec2 cellExits = ((cell + forward) * cellSize - ray.start) * heading / pace;
    float exitTravel = min(min(cellExits.x, cellExits.y), travelLimit);
    ivec2 texel = ivec2(ray.permuted ? cell.yx : cell);
    vec2 slab = texelFetch(u_depthSlabs, clamp(texel, ivec2(0), textureSize(u_depthSlabs, level) - 1), level).rg;
    float entryDepth = -rayViewZ(ray, travel);
    float exitDepth = -rayViewZ(ray, exitTravel);
    bool inFront = max(entryDepth, exitDepth) < slab.x;
    bool behind = min(entryDepth, exitDepth) > slab.y;
    if (!inFront && !behind) {
      if (level > 0) {
        level--;
        continue;
      }
      texel = clamp(texel, ivec2(0), ivec2(u_sceneSize) - 1);
      SurfaceFacet facet = readSurfaceFacet(texel);
      vec2 center = vec2(texel) + 0.5;
      vec2 entryPixel = rayPixel(ray, travel);
      vec2 exitPixel = rayPixel(ray, exitTravel);
      float entryGap = entryDepth - facetDepthAt(facet, entryPixel - center);
      float exitGap = exitDepth - facetDepthAt(facet, exitPixel - center);
      float tolerance = facet.depth * facet.depth * u_depthQuantum;
      inFront = max(entryGap, exitGap) < tolerance;
      bool buried = min(entryGap, exitGap) > facet.thickness;
      bool backFacing = facet.oriented && dot(facet.normal, direction) > 0.0;
      if (!(inFront || buried || backFacing)) {
        float crossing = clamp((tolerance - entryGap) / (exitGap - entryGap), 0.0, 1.0);
        vec2 crossingOffset = mix(entryPixel, exitPixel, crossing) - center;
        vec2 offset = entryGap >= tolerance ? vec2(0.0) : seamlessOffset(facet, texel, crossingOffset);
        trace.hit = true;
        trace.pixel = center + offset;
        trace.depth = facetDepthAt(facet, offset);
        return trace;
      }
    }
    occluded = !inFront;
    travel = exitTravel;
    vec2 nextCell = floor((ray.start + ray.pixelStep * travel + heading * TRACE_CELL_BIAS) / cellSize);
    if (level < u_slabMaxLevel && any(notEqual(floor(nextCell * 0.5), floor(cell * 0.5)))) level++;
  }
  return trace;
}
`;
