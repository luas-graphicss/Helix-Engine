import { StreamLanguage } from '@codemirror/language';
import { C_IDENTIFIER, cLikeParser, wordSet, type LanguageVocabulary } from './stream-utils';
const KEYWORDS = wordSet('alias break case const const_assert continue continuing default diagnostic discard else enable fn for if let loop override requires return struct switch var while function private workgroup uniform storage read write read_write');
const TYPES = wordSet('bool f16 f32 i32 u32 vec2 vec3 vec4 vec2f vec3f vec4f vec2i vec3i vec4i vec2u vec3u vec4u vec2h vec3h vec4h mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4 mat2x2f mat2x3f mat2x4f mat3x2f mat3x3f mat3x4f mat4x2f mat4x3f mat4x4f mat2x2h mat2x3h mat2x4h mat3x2h mat3x3h mat3x4h mat4x2h mat4x3h mat4x4h array atomic ptr sampler sampler_comparison texture_1d texture_2d texture_2d_array texture_3d texture_cube texture_cube_array texture_multisampled_2d texture_depth_multisampled_2d texture_external texture_storage_1d texture_storage_2d texture_storage_2d_array texture_storage_3d texture_depth_2d texture_depth_2d_array texture_depth_cube texture_depth_cube_array');
const BUILTINS = wordSet('abs acos acosh all any arrayLength asin asinh atan atan2 atanh atomicAdd atomicAnd atomicCompareExchangeWeak atomicExchange atomicLoad atomicMax atomicMin atomicOr atomicStore atomicSub atomicXor bitcast ceil clamp cos cosh countLeadingZeros countOneBits countTrailingZeros cross degrees determinant distance dot dot4I8Packed dot4U8Packed dpdx dpdxCoarse dpdxFine dpdy dpdyCoarse dpdyFine exp exp2 extractBits faceForward firstLeadingBit firstTrailingBit floor fma fract frexp fwidth fwidthCoarse fwidthFine insertBits inverseSqrt ldexp length log log2 max min mix modf normalize pack2x16float pack2x16snorm pack2x16unorm pack4x8snorm pack4x8unorm pack4xI8 pack4xU8 pow quantizeToF16 radians reflect refract reverseBits round saturate select sign sin sinh smoothstep sqrt step storageBarrier tan tanh textureBarrier textureDimensions textureGather textureGatherCompare textureLoad textureNumLayers textureNumLevels textureNumSamples textureSample textureSampleBias textureSampleCompare textureSampleCompareLevel textureSampleGrad textureSampleLevel textureSampleBaseClampToEdge textureStore transpose trunc unpack2x16float unpack2x16snorm unpack2x16unorm unpack4x8snorm unpack4x8unorm unpack4xI8 unpack4xU8 workgroupBarrier workgroupUniformLoad');
const ATOMS = wordSet('true false');
export const wgslVocabulary: LanguageVocabulary = { keywords: KEYWORDS, types: TYPES, builtins: BUILTINS, atoms: ATOMS };
export const wgslLanguage = StreamLanguage.define(cLikeParser({
    keywords: KEYWORDS,
    types: TYPES,
    builtins: BUILTINS,
    atoms: ATOMS,
    attributes: true,
    nestedBlockComments: true,
    callsAsFunctions: true,
    definitionKeywords: wordSet('fn struct alias'),
    number: /^(?:0[xX][0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?(?:[pP][+-]?\d+)?[iufh]?|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[iufh]?)/,
    identifier: C_IDENTIFIER,
}, {
    name: 'wgsl',
    languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } }, closeBrackets: { brackets: ['(', '[', '{', '"'] } },
}));
