import { MAX_TERRAIN_LAYERS } from '@/engine/terrain/core/splat-map';
import { VT_CACHE_TEXELS, VT_LEVELS, VT_PAGE_BORDER, VT_PAGE_TEXELS, VT_PAGES_PER_SIDE, VT_SLOT_TEXELS, VT_VIRTUAL_SIZE_LOG2, } from '@/engine/renderer/terrain/virtual-texture/vt-layout';
export const TERRAIN_VIRTUAL_TEXTURE_CHUNK = `
uniform highp usampler2DArray u_vtPages;
uniform sampler2DArray u_vtCacheAlbedo;
uniform sampler2DArray u_vtCacheNormal;
                                                                                               
uniform vec4 u_vtLayer[${MAX_TERRAIN_LAYERS}];

const float VT_VIRTUAL_LOG2 = ${VT_VIRTUAL_SIZE_LOG2}.0;
const int VT_LEVELS = ${VT_LEVELS};
const float VT_PAGES0 = ${VT_PAGES_PER_SIDE}.0;
const float VT_PAGE = ${VT_PAGE_TEXELS}.0;
const float VT_BORDER = ${VT_PAGE_BORDER}.0;
const float VT_SLOT = ${VT_SLOT_TEXELS}.0;
const float VT_CACHE = ${VT_CACHE_TEXELS}.0;

   
                                                                                    
                                                                                
   
bool vtSample(sampler2DArray cache, int slice, float sizeLog2, vec2 uv, vec2 dx, vec2 dy, out vec4 result) {
  float texels = exp2(sizeLog2);
  float rho2 = max(dot(dx, dx), dot(dy, dy)) * texels * texels;
  float lod = 0.5 * log2(max(rho2, 1e-12));
                                                                                     
  int level = int(floor(lod + (VT_VIRTUAL_LOG2 - sizeLog2) + 0.5));
  if (level >= VT_LEVELS) return false;
  level = max(level, 0);
  float pages = VT_PAGES0 / exp2(float(level));
  vec2 st = fract(uv);
  ivec2 page = ivec2(min(floor(st * pages), pages - 1.0));
  uvec4 entry = texelFetch(u_vtPages, ivec3(page, slice), level);
  if (entry.a == 0u) return false;
  float residentPages = VT_PAGES0 / exp2(float(int(entry.a) - 1));
  vec2 inPage = fract(st * residentPages);
  vec2 texel = vec2(entry.rg) * VT_SLOT + VT_BORDER + inPage * VT_PAGE;
  result = textureLod(cache, vec3(texel / VT_CACHE, float(entry.b)), 0.0);
  return true;
}
`;
