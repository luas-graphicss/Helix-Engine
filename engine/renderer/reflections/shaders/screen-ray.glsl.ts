export const SCREEN_RAY_CHUNK = `
struct ScreenRay {
  vec2 start;
  vec2 pixelStep;
  float startDepthOverW;
  float depthOverWStep;
  float startInverseW;
  float inverseWStep;
  float extent;
  bool permuted;
};

ScreenRay projectScreenRay(vec3 origin, vec3 direction) {
  float maxDistance = u_traceParams.w;
  float rayLength = (origin.z + direction.z * maxDistance > -u_nearPlane) ? (-u_nearPlane - origin.z) / direction.z : maxDistance;
  vec3 endPoint = origin + direction * rayLength;

  vec4 startClip = u_projection * vec4(origin, 1.0);
  vec4 endClip = u_projection * vec4(endPoint, 1.0);
  float startInverseW = 1.0 / startClip.w;
  float endInverseW = 1.0 / endClip.w;
  vec2 startPixel = (startClip.xy * startInverseW * 0.5 + 0.5) * u_sceneSize;
  vec2 endPixel = (endClip.xy * endInverseW * 0.5 + 0.5) * u_sceneSize;
  endPixel += vec2(dot(endPixel - startPixel, endPixel - startPixel) < 0.0001 ? 0.01 : 0.0);

  vec2 delta = endPixel - startPixel;
  ScreenRay ray;
  ray.permuted = abs(delta.x) < abs(delta.y);
  if (ray.permuted) {
    delta = delta.yx;
    startPixel = startPixel.yx;
  }
  ray.extent = abs(delta.x);
  float inverseExtent = 1.0 / ray.extent;
  ray.start = startPixel;
  ray.pixelStep = delta * inverseExtent;
  ray.startDepthOverW = origin.z * startInverseW;
  ray.depthOverWStep = (endPoint.z * endInverseW - ray.startDepthOverW) * inverseExtent;
  ray.startInverseW = startInverseW;
  ray.inverseWStep = (endInverseW - startInverseW) * inverseExtent;
  return ray;
}

vec2 rayPixel(ScreenRay ray, float travel) {
  vec2 pixel = ray.start + ray.pixelStep * travel;
  return ray.permuted ? pixel.yx : pixel;
}

float rayViewZ(ScreenRay ray, float travel) {
  return (ray.startDepthOverW + ray.depthOverWStep * travel) / (ray.startInverseW + ray.inverseWStep * travel);
}
`;
