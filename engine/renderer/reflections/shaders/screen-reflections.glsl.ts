import { HDR_ENCODING_CHUNK, HDR_RANGE_SCENE } from '@/engine/renderer/shaders/chunks/hdr-encoding.glsl';
import { DEPTH_SLAB_TRACE_CHUNK } from './depth-slab-trace.glsl';
import { SCREEN_SAMPLING_CHUNK } from './screen-sampling.glsl';
import { SURFACE_BUFFER_ENCODING_CHUNK } from './surface-buffer.glsl';
export const SCREEN_REFLECTIONS_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D u_sceneDepth;
uniform sampler2D u_surface;
uniform sampler2D u_history;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat4 u_reprojection;
uniform vec2 u_sceneSize;
uniform float u_nearPlane;
uniform float u_roughnessCutoff;

${HDR_ENCODING_CHUNK}
${SURFACE_BUFFER_ENCODING_CHUNK}
${SCREEN_SAMPLING_CHUNK}
${DEPTH_SLAB_TRACE_CHUNK}

out vec4 fragColor;

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  float bufferDepth = texelFetch(u_sceneDepth, pixel, 0).r;
  SurfaceSample surface = decodeSurfaceBuffer(texelFetch(u_surface, pixel, 0));
  if (bufferDepth >= 1.0 || !surface.valid || surface.roughness > u_roughnessCutoff) {
    fragColor = vec4(0.0);
    return;
  }

  vec3 origin = viewRayAt(gl_FragCoord.xy) * -viewZFromDepth(bufferDepth);
  vec3 direction = reflect(normalize(origin), mat3(u_view) * surface.N);
  float facingFade = 1.0 - smoothstep(0.55, 0.95, direction.z);
  if (facingFade <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }

  SlabTrace trace = traceDepthSlabs(origin, direction);
  vec4 previousClip = vec4(0.0);
  float confidence = 0.0;
  if (trace.hit) {
    previousClip = u_reprojection * vec4(viewRayAt(trace.pixel) * trace.depth, 1.0);
    confidence = screenEdgeFade(trace.pixel / u_sceneSize);
  } else if (trace.escaped) {
    vec2 skyUv;
    previousClip = u_reprojection * vec4(direction, 0.0);
    confidence = skyDirectionUv(direction, skyUv);
  }
  if (confidence <= 0.0 || previousClip.w <= 1e-4) {
    fragColor = vec4(0.0);
    return;
  }
  vec2 previousUv = previousClip.xy / previousClip.w * 0.5 + 0.5;
  if (any(lessThan(previousUv, vec2(0.0))) || any(greaterThan(previousUv, vec2(1.0)))) {
    fragColor = vec4(0.0);
    return;
  }

  vec3 color = decodeHdr(texture(u_history, previousUv), ${HDR_RANGE_SCENE}.0).rgb;
  confidence *= facingFade * screenEdgeFade(previousUv);
  fragColor = encodeHdr(color * confidence, confidence, ${HDR_RANGE_SCENE}.0);
}
`;
