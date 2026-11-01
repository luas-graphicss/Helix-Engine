import { HDR_ENCODING_CHUNK, HDR_RANGE_SCENE } from '@/engine/renderer/shaders/chunks/hdr-encoding.glsl';
import { SCREEN_TRACE_CHUNK } from './screen-trace.glsl';
import { SURFACE_BUFFER_ENCODING_CHUNK } from './surface-buffer.glsl';
export const SCREEN_REFLECTIONS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_sceneDepth;
uniform sampler2D u_surface;
uniform sampler2D u_history;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat4 u_inverseViewProjection;
uniform mat4 u_previousViewProjection;
uniform vec3 u_cameraPosition;
uniform vec2 u_sceneSize;
uniform vec2 u_targetSize;
uniform vec4 u_traceParams;
uniform float u_nearPlane;
uniform float u_roughnessCutoff;

${HDR_ENCODING_CHUNK}
${SURFACE_BUFFER_ENCODING_CHUNK}
${SCREEN_TRACE_CHUNK}

out vec4 fragColor;

vec3 unprojectWorld(vec2 uv, float depth) {
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 world = u_inverseViewProjection * clip;
  return world.xyz / world.w;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_targetSize;
  ivec2 scenePixel = ivec2(uv * u_sceneSize);
  float depth = texelFetch(u_sceneDepth, scenePixel, 0).r;
  SurfaceSample surface = decodeSurfaceBuffer(texelFetch(u_surface, scenePixel, 0));
  if (depth >= 1.0 || !surface.valid || surface.roughness > u_roughnessCutoff) {
    fragColor = vec4(0.0);
    return;
  }

  vec3 worldPosition = unprojectWorld(uv, depth);
  vec3 V = normalize(u_cameraPosition - worldPosition);
  vec3 R = reflect(-V, surface.N);
  vec3 viewOrigin = (u_view * vec4(worldPosition, 1.0)).xyz;
  vec3 viewDirection = mat3(u_view) * R;
                                                                                                
  float facingFade = 1.0 - smoothstep(0.55, 0.95, viewDirection.z);
  if (facingFade <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }
                                                                                                      
  viewOrigin += (mat3(u_view) * surface.N) * (0.02 + 0.004 * abs(viewOrigin.z));

  ScreenTrace trace = traceScreenRay(viewOrigin, viewDirection);
  if (!trace.hit) {
                                                                                                               
                                                                                                         
    vec2 skyUv;
    float skyConfidence = skyDirectionUv(viewDirection, skyUv) * facingFade;
    vec4 previousClip = u_previousViewProjection * vec4(R, 0.0);
    if (skyConfidence <= 0.0 || previousClip.w <= 1e-4) {
      fragColor = vec4(0.0);
      return;
    }
    vec2 previousUv = previousClip.xy / previousClip.w * 0.5 + 0.5;
    if (any(lessThan(previousUv, vec2(0.0))) || any(greaterThan(previousUv, vec2(1.0)))) {
      fragColor = vec4(0.0);
      return;
    }
    vec3 sky = decodeHdr(texture(u_history, previousUv), ${HDR_RANGE_SCENE}.0).rgb;
    fragColor = encodeHdr(sky, skyConfidence * screenEdgeFade(previousUv), ${HDR_RANGE_SCENE}.0);
    return;
  }

  float hitDepth = texelFetch(u_sceneDepth, ivec2(trace.uv * u_sceneSize), 0).r;
  vec3 hitWorld = unprojectWorld(trace.uv, hitDepth);
  vec4 previousClip = u_previousViewProjection * vec4(hitWorld, 1.0);
  if (previousClip.w <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }
  vec2 previousUv = previousClip.xy / previousClip.w * 0.5 + 0.5;
  if (any(lessThan(previousUv, vec2(0.0))) || any(greaterThan(previousUv, vec2(1.0)))) {
    fragColor = vec4(0.0);
    return;
  }

  vec3 color = decodeHdr(texture(u_history, previousUv), ${HDR_RANGE_SCENE}.0).rgb;
  float confidence = trace.confidence * facingFade * screenEdgeFade(previousUv);
  fragColor = encodeHdr(color, confidence, ${HDR_RANGE_SCENE}.0);
}
`;
