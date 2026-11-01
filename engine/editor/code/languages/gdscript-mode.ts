import { StreamLanguage, type StringStream } from '@codemirror/language';
import { wordSet, type LanguageVocabulary } from './stream-utils';
const KEYWORDS = wordSet('if elif else for while match when break continue pass return class class_name extends is in as signal func static const enum var breakpoint preload await yield assert void not and or');
const ATOMS = wordSet('true false null PI TAU INF NAN');
const SPECIALS = wordSet('self super helix');
const TYPES = wordSet('int float bool String StringName NodePath Variant Array Dictionary Callable Signal Object RefCounted Resource Node Node2D Node3D Control CanvasItem PackedScene Vector2 Vector2i Vector3 Vector3i Vector4 Vector4i Color Rect2 Rect2i AABB Plane Quaternion Basis Transform2D Transform3D Projection RID PackedByteArray PackedInt32Array PackedInt64Array PackedFloat32Array PackedFloat64Array PackedStringArray PackedVector2Array PackedVector3Array PackedColorArray');
const BUILTINS = wordSet('print printerr printt prints printraw print_rich push_error push_warning range len str int float bool abs sign floor ceil round clamp lerp lerpf inverse_lerp remap min max maxi mini sqrt pow exp log sin cos tan asin acos atan atan2 fmod fposmod posmod wrap wrapf wrapi randf randi randomize randf_range randi_range randfn seed deg_to_rad rad_to_deg is_instance_valid is_equal_approx is_zero_approx snapped load typeof type_string var_to_str str_to_var weakref hash instance_from_id Engine Input OS Time ResourceLoader get_node get_tree get_parent add_child remove_child queue_free instantiate emit_signal connect disconnect call call_deferred set_process set_physics_process');
const DEFINITION_KEYWORDS = wordSet('func var const signal class class_name enum');
const TYPE_KEYWORDS = wordSet('extends is as');
export const gdscriptVocabulary: LanguageVocabulary = { keywords: KEYWORDS, types: TYPES, builtins: BUILTINS, atoms: ATOMS };
interface GdState {
    longString: string | null;
    expectDefinition: boolean;
    expectType: boolean;
    parenDepth: number;
    lineIndent: number;
    opensBlock: boolean;
}
const NUMBER = /^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)/;
const IDENTIFIER = /^[A-Za-z_]\w*/;
const OPENS_BLOCK = /^\s*(?:#.*)?$/;
function readLong(stream: StringStream, state: GdState): string {
    const close = state.longString!;
    while (!stream.eol()) {
        if (stream.match(close)) {
            state.longString = null;
            return 'string';
        }
        stream.next();
    }
    return 'string';
}
function readQuoted(stream: StringStream, quote: string): void {
    let escaped = false;
    while (!stream.eol()) {
        const char = stream.next();
        if (char === quote && !escaped)
            return;
        escaped = !escaped && char === '\\';
    }
}
function token(stream: StringStream, state: GdState): string | null {
    if (state.longString)
        return readLong(stream, state);
    if (stream.sol()) {
        state.lineIndent = stream.indentation();
        state.opensBlock = false;
    }
    if (stream.eatSpace())
        return null;
    if (stream.peek() === '#') {
        stream.skipToEnd();
        return 'comment';
    }
    if (stream.match(/^@[A-Za-z_]\w*/))
        return 'meta';
    if (stream.match(/^\$[A-Za-z_][\w/]*/) || stream.match(/^%[A-Za-z_]\w*/))
        return 'variableName.special';
    const long = stream.match(/^(?:[rR]|&|\^)?("""|''')/);
    if (long) {
        state.longString = (long as RegExpMatchArray)[1];
        return readLong(stream, state);
    }
    const quoted = stream.match(/^(?:[rR]|&|\^)?(["'])/);
    if (quoted) {
        readQuoted(stream, (quoted as RegExpMatchArray)[1]);
        return 'string';
    }
    if (stream.match(NUMBER))
        return 'number';
    if (stream.match(IDENTIFIER)) {
        const word = stream.current();
        if (state.expectDefinition) {
            state.expectDefinition = false;
            if (KEYWORDS.has(word))
                return 'keyword';
            return 'variableName.definition';
        }
        if (state.expectType) {
            state.expectType = false;
            if (ATOMS.has(word))
                return 'atom';
            if (KEYWORDS.has(word))
                return 'keyword';
            return 'typeName';
        }
        if (DEFINITION_KEYWORDS.has(word)) {
            state.expectDefinition = true;
            return 'keyword';
        }
        if (TYPE_KEYWORDS.has(word)) {
            state.expectType = true;
            return 'keyword';
        }
        if (KEYWORDS.has(word))
            return 'keyword';
        if (ATOMS.has(word))
            return 'atom';
        if (SPECIALS.has(word))
            return 'variableName.special';
        if (TYPES.has(word))
            return 'typeName';
        if (BUILTINS.has(word))
            return 'variableName.standard';
        const rest = stream.string.slice(stream.pos);
        if (/^\s*\(/.test(rest))
            return 'variableName.function';
        if (/\.$/.test(stream.string.slice(0, stream.start)))
            return 'propertyName';
        if (/^[A-Z][a-z]/.test(word))
            return 'typeName';
        return 'variableName';
    }
    if (stream.match('->')) {
        state.expectType = true;
        return 'operator';
    }
    if (stream.match(/^[{([]/)) {
        state.parenDepth++;
        return 'bracket';
    }
    if (stream.match(/^[})\]]/)) {
        state.parenDepth = Math.max(0, state.parenDepth - 1);
        return 'bracket';
    }
    if (stream.match(':='))
        return 'operator';
    if (stream.match(':')) {
        const rest = stream.string.slice(stream.pos);
        if (/^\s*[A-Za-z_]/.test(rest))
            state.expectType = true;
        if (OPENS_BLOCK.test(rest))
            state.opensBlock = true;
        return 'punctuation';
    }
    if (stream.match(/^[;,.]/))
        return 'punctuation';
    if (stream.match(/^(?:\*\*=?|<<=?|>>=?|[-+*/%&|^~!<>=]=?|&&|\|\|)/))
        return 'operator';
    stream.next();
    return null;
}
const DEDENTS = /^\s*(?:else|elif)\b/;
export const gdscriptLanguage = StreamLanguage.define<GdState>({
    name: 'gdscript',
    startState: () => ({ longString: null, expectDefinition: false, expectType: false, parenDepth: 0, lineIndent: 0, opensBlock: false }),
    token,
    blankLine: (state) => {
        state.expectDefinition = false;
        state.expectType = false;
    },
    indent: (state, textAfter, context) => {
        if (state.longString)
            return null;
        if (DEDENTS.test(textAfter))
            return Math.max(0, state.lineIndent - context.unit);
        return state.opensBlock ? state.lineIndent + context.unit : state.lineIndent;
    },
    languageData: {
        commentTokens: { line: '#' },
        closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
        indentOnInput: /^\s*(?:else|elif)\b/,
    },
});
