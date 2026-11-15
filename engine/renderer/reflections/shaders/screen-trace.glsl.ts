import { SCREEN_RAY_CHUNK } from './screen-ray.glsl';
import { SCREEN_SAMPLING_CHUNK } from './screen-sampling.glsl';
const FINE_STEPS_PER_STRIDE = 8;
const SPECULATIVE_SCAN_BUDGET = 4;
export const SCREEN_TRACE_CHUNK = `
${SCREEN_RAY_CHUNK}
${SCREEN_SAMPLING_CHUNK}

const int TRACE_FINE_STEPS = ${FINE_STEPS_PER_STRIDE};
const float TRACE_SPECULATIVE_SCANS = ${SPECULATIVE_SCAN_BUDGET}.0;

struct ScreenTrace {
  bool hit;
  vec2 uv;
  float confidence;
};

float sceneViewZAt(vec2 pixel) {
  ivec2 texel = clamp(ivec2(pixel), ivec2(0), ivec2(u_sceneSize) - 1);
  return viewZFromDepth(texelFetch(u_sceneDepth, texel, 0).r);
}

float surfaceThickness(float sceneZ) {
  return u_traceParams.z * (1.0 + 0.04 * abs(sceneZ));
}

ScreenTrace traceScreenRay(vec3 origin, vec3 direction) {
  ScreenTrace result;
  result.hit = false;
  result.uv = vec2(0.0);
  result.confidence = 0.0;

  float maxSteps = u_traceParams.x;
  float stride = u_traceParams.y;
  float fineStride = stride / float(TRACE_FINE_STEPS);
  ScreenRay ray = projectScreenRay(origin, direction, u_traceParams.w);

  float traveled = 0.0;
  float previousRayZ = origin.z;
  float previousSceneZ = origin.z;
  bool occluded = false;
  float speculativeScans = 0.0;
  float hitTravel = 0.0;
  float frontTravel = 0.0;
  float hitOvershoot = 0.0;
  float hitThickness = 1.0;

  for (float i = 0.0; i < maxSteps; i += 1.0) {
    float travel = traveled + stride;
    if (travel > ray.extent) break;
    vec2 pixel = rayPixel(ray, travel);
    if (any(lessThan(pixel, vec2(0.0))) || any(greaterThanEqual(pixel, u_sceneSize))) break;

    float sceneZ = sceneViewZAt(pixel);
    float rayZ = rayViewZ(ray, travel);
    bool behind = rayZ <= sceneZ;
    bool surfaceReceded = sceneZ < previousSceneZ - surfaceThickness(previousSceneZ);
    bool skippedEntry = !behind && !occluded && surfaceReceded && rayZ <= previousSceneZ;
    bool emerged = behind && occluded && surfaceReceded;
    bool speculative = (skippedEntry || emerged) && speculativeScans < TRACE_SPECULATIVE_SCANS;
    bool entered = behind && !occluded;

    if (i == 0.0 || entered || speculative) {
      if (speculative) speculativeScans += 1.0;
      float lastFrontTravel = traveled;
      float lastFrontRayZ = previousRayZ;
      for (int j = 1; j <= TRACE_FINE_STEPS; j++) {
        float fineTravel = traveled + fineStride * float(j);
        float fineRayZ = rayViewZ(ray, fineTravel);
        float fineSceneZ = sceneViewZAt(rayPixel(ray, fineTravel));
        if (fineRayZ > fineSceneZ) {
          occluded = false;
          lastFrontTravel = fineTravel;
          lastFrontRayZ = fineRayZ;
          continue;
        }
        if (occluded) continue;
        float overshoot = fineSceneZ - lastFrontRayZ;
        float thickness = surfaceThickness(fineSceneZ);
        if (overshoot <= thickness) {
          result.hit = true;
          hitTravel = fineTravel;
          frontTravel = lastFrontTravel;
          hitOvershoot = overshoot;
          hitThickness = thickness;
          break;
        }
        occluded = true;
      }
      if (result.hit) break;
    } else {
      occluded = behind;
    }
    previousSceneZ = sceneZ;
    previousRayZ = rayZ;
    traveled = travel;
  }
  if (!result.hit) return result;

  float middleTravel = 0.5 * (frontTravel + hitTravel);
  if (rayViewZ(ray, middleTravel) <= sceneViewZAt(rayPixel(ray, middleTravel))) hitTravel = middleTravel;

  vec2 hitPixel = clamp(rayPixel(ray, hitTravel), vec2(0.5), u_sceneSize - 0.5);
  result.uv = hitPixel / u_sceneSize;
  float travelFraction = hitTravel / (maxSteps * stride);
  float travelFade = 1.0 - travelFraction * travelFraction;
  float thicknessFade = 1.0 - smoothstep(0.0, hitThickness, hitOvershoot);
  result.confidence = screenEdgeFade(result.uv) * travelFade * thicknessFade;
  return result;
}
`;
