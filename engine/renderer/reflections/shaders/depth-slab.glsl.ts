import { SCREEN_SAMPLING_CHUNK } from './screen-sampling.glsl';
import { SURFACE_BUFFER_ENCODING_CHUNK } from './surface-buffer.glsl';
import { SURFACE_FACET_CHUNK } from './surface-facet.glsl';
export const DEPTH_SLAB_BASE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D u_sceneDepth;
uniform sampler2D u_surface;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform vec2 u_sceneSize;

${SURFACE_BUFFER_ENCODING_CHUNK}
${SCREEN_SAMPLING_CHUNK}
${SURFACE_FACET_CHUNK}

layout(location = 0) out vec2 fragSlab;

void main() {
  SurfaceFacet facet = readSurfaceFacet(ivec2(gl_FragCoord.xy));
  fragSlab = vec2(facet.depth - facet.extent, facet.depth + facet.extent + facet.thickness);
}
`;
export const DEPTH_SLAB_REDUCE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D u_slabs;

layout(location = 0) out vec2 fragSlab;

void main() {
  ivec2 sourceSize = textureSize(u_slabs, 0);
  ivec2 corner = ivec2(gl_FragCoord.xy) * 2;
  ivec2 reach = ivec2(1) + (sourceSize & 1);
  vec2 slab = texelFetch(u_slabs, min(corner, sourceSize - 1), 0).rg;
  for (int y = 0; y <= reach.y; y++) {
    for (int x = 0; x <= reach.x; x++) {
      vec2 texel = texelFetch(u_slabs, min(corner + ivec2(x, y), sourceSize - 1), 0).rg;
      slab = vec2(min(slab.x, texel.x), max(slab.y, texel.y));
    }
  }
  fragSlab = slab;
}
`;
