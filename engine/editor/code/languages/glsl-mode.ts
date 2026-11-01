import { StreamLanguage } from '@codemirror/language';
import { C_IDENTIFIER, cLikeParser, wordSet, type LanguageVocabulary } from './stream-utils';
const KEYWORDS = wordSet('attribute const uniform varying buffer shared coherent volatile restrict readonly writeonly layout centroid flat smooth noperspective patch sample break continue do for while switch case default if else in out inout invariant precise discard return lowp mediump highp precision struct');
const TYPES = wordSet('void bool int uint float double vec2 vec3 vec4 dvec2 dvec3 dvec4 bvec2 bvec3 bvec4 ivec2 ivec3 ivec4 uvec2 uvec3 uvec4 mat2 mat3 mat4 mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4 sampler2D sampler3D samplerCube sampler2DShadow samplerCubeShadow sampler2DArray sampler2DArrayShadow isampler2D isampler3D isamplerCube isampler2DArray usampler2D usampler3D usamplerCube usampler2DArray');
const BUILTINS = wordSet('radians degrees sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh pow exp log exp2 log2 sqrt inversesqrt abs sign floor trunc round roundEven ceil fract mod modf min max clamp mix step smoothstep isnan isinf floatBitsToInt floatBitsToUint intBitsToFloat uintBitsToFloat packSnorm2x16 packUnorm2x16 unpackSnorm2x16 unpackUnorm2x16 packHalf2x16 unpackHalf2x16 length distance dot cross normalize faceforward reflect refract matrixCompMult outerProduct transpose determinant inverse lessThan lessThanEqual greaterThan greaterThanEqual equal notEqual any all not textureSize texture textureProj textureLod textureOffset texelFetch texelFetchOffset textureProjOffset textureLodOffset textureProjLod textureProjLodOffset textureGrad textureGradOffset textureProjGrad textureProjGradOffset dFdx dFdy fwidth');
const ATOMS = wordSet('true false');
export const glslVocabulary: LanguageVocabulary = { keywords: KEYWORDS, types: TYPES, builtins: BUILTINS, atoms: ATOMS };
export const glslLanguage = StreamLanguage.define(cLikeParser({
    keywords: KEYWORDS,
    types: TYPES,
    builtins: BUILTINS,
    atoms: ATOMS,
    specialPrefix: /^gl_[A-Za-z_]\w*/,
    preprocessor: true,
    callsAsFunctions: true,
    number: /^(?:0[xX][0-9a-fA-F]+[uU]?|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[fFuU]?)/,
    identifier: C_IDENTIFIER,
}, {
    name: 'glsl',
    languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } }, closeBrackets: { brackets: ['(', '[', '{', '"'] } },
}));
