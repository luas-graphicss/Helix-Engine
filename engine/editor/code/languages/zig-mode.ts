import { StreamLanguage, type StringStream } from '@codemirror/language';
import { C_IDENTIFIER, cLikeParser, cLikeToken, wordSet, type CLikeSpec, type CLikeState, type LanguageVocabulary } from './stream-utils';
const KEYWORDS = wordSet('addrspace align allowzero and anyframe anytype asm async await break callconv catch comptime const continue defer else enum errdefer error export extern for if inline linksection noalias noinline nosuspend opaque or orelse packed pub resume return struct suspend switch test threadlocal try union unreachable usingnamespace var volatile while');
const TYPES = wordSet('isize usize f16 f32 f64 f80 f128 bool void noreturn type anyerror anyopaque comptime_int comptime_float c_char c_short c_ushort c_int c_uint c_long c_ulong c_longlong c_ulonglong c_longdouble');
const ATOMS = wordSet('true false null undefined');
const BUILTINS = wordSet('@import @cImport @cInclude @as @intCast @floatCast @intFromFloat @floatFromInt @ptrCast @alignCast @bitCast @truncate @sizeOf @alignOf @typeOf @typeInfo @TypeOf @This @field @hasField @hasDecl @embedFile @panic @compileError @compileLog @memcpy @memset @min @max @abs @sqrt @sin @cos @tan @exp @log @floor @ceil @round @trunc @mod @rem @divTrunc @divFloor @divExact @addWithOverflow @subWithOverflow @mulWithOverflow @splat @reduce @select @shuffle @Vector @enumFromInt @intFromEnum @tagName @errorName @errorFromInt @intFromError @returnAddress @src @setEvalBranchQuota @setRuntimeSafety @export @extern @call @fieldParentPtr @offsetOf @bitOffsetOf @ctz @clz @popCount @byteSwap @bitReverse @wasmMemorySize @wasmMemoryGrow');
export const zigVocabulary: LanguageVocabulary = { keywords: KEYWORDS, types: TYPES, builtins: BUILTINS, atoms: ATOMS };
const SPEC: CLikeSpec = {
    keywords: KEYWORDS,
    types: TYPES,
    atoms: ATOMS,
    specialPrefix: /^@[A-Za-z_]\w*/,
    callsAsFunctions: true,
    definitionKeywords: wordSet('fn'),
    number: /^(?:0[xX][0-9a-fA-F_]+(?:\.[0-9a-fA-F_]*)?(?:[pP][+-]?\d+)?|0[oO][0-7_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)/,
    identifier: C_IDENTIFIER,
};
const SIZED_INTEGER = /^[iu]\d+$/;
function zigToken(stream: StringStream, state: CLikeState): string | null {
    if (state.blockDepth === 0) {
        if (stream.eatSpace())
            return null;
        if (stream.match(/^\\\\/)) {
            stream.skipToEnd();
            return 'string';
        }
        if (stream.match(/^'(?:\\.|[^'\\])'/))
            return 'string';
    }
    const token = cLikeToken(stream, state, SPEC);
    if (token === 'variableName' && SIZED_INTEGER.test(stream.current()))
        return 'typeName';
    return token;
}
export const zigLanguage = StreamLanguage.define({
    ...cLikeParser(SPEC, { name: 'zig', languageData: { commentTokens: { line: '//' }, closeBrackets: { brackets: ['(', '[', '{', '"'] } } }),
    token: zigToken,
});
