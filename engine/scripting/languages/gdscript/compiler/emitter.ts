import type { Annotation, AssignmentStatement, BinaryExpression, Block, CallExpression, ClassDeclaration, EnumMember, Expression, FunctionMember, IdentifierExpression, LambdaExpression, MatchStatement, MemberExpression, Parameter, Pattern, Resolution, ScriptFile, Statement, StaticType, TypeRef, UnaryExpression, VariableMember, } from './ast';
import { jsIdentifier, siblingAccess, siblingAlias, type ClassInfo, type ProgramInfo, type StaticInit } from './analyzer';
import { JsWriter } from '../../../compiler/js-writer';
import type { SourceSpan } from './tokens';
import { NODE_METHODS, NODE_PROPERTIES, isGodotNodeClass } from '../runtime/godot-api';
export interface EmitInput {
    readonly file: ScriptFile;
    readonly program: ProgramInfo;
    readonly fileName: string;
    readonly scriptName: string;
    readonly source: string;
}
export interface EmitOutput {
    readonly code: string;
    readonly sourceMap: string;
}
const VECTOR_TYPES: ReadonlySet<string> = new Set(['Vector2', 'Vector2i', 'Vector3', 'Vector3i', 'Vector4']);
const VALUE_TYPES: ReadonlySet<string> = new Set([...VECTOR_TYPES, 'Quaternion', 'Basis', 'Transform3D', 'Color', 'Rect2', 'AABB']);
const STRING_TYPES: ReadonlySet<string> = new Set(['String', 'StringName', 'NodePath']);
const PACKED_TYPES: ReadonlySet<string> = new Set(['PackedByteArray', 'PackedInt32Array', 'PackedInt64Array', 'PackedFloat32Array', 'PackedFloat64Array', 'PackedStringArray', 'PackedVector2Array', 'PackedVector3Array', 'PackedColorArray']);
const VALUE_FIELDS: Readonly<Record<string, readonly string[]>> = {
    Vector2: ['x', 'y'],
    Vector2i: ['x', 'y'],
    Vector3: ['x', 'y', 'z'],
    Vector3i: ['x', 'y', 'z'],
    Vector4: ['x', 'y', 'z', 'w'],
    Quaternion: ['x', 'y', 'z', 'w'],
    Color: ['r', 'g', 'b', 'a', 'r8', 'g8', 'b8', 'a8', 'h', 's', 'v'],
    Basis: ['x', 'y', 'z'],
    Transform3D: ['basis', 'origin'],
    Rect2: ['position', 'size', 'end'],
    AABB: ['position', 'size', 'end'],
};
const COMPARISON: Readonly<Record<string, string>> = { '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge' };
const BITWISE: Readonly<Record<string, string>> = { '&': 'band', '|': 'bor', '^': 'bxor', '<<': 'shl', '>>': 'shr' };
const ARITHMETIC: Readonly<Record<string, string>> = { '+': 'add', '-': 'sub', '*': 'mul', '**': 'pow' };
const INDENT = '  ';
function q(text: string): string {
    return JSON.stringify(text);
}
function isNumeric(type: StaticType | undefined): boolean {
    return type === 'int' || type === 'float';
}
function isArrayType(type: StaticType): boolean {
    return type === 'Array' || type.startsWith('Array[') || PACKED_TYPES.has(type);
}
function baseTypeName(type: StaticType): string {
    const generic = type.indexOf('[');
    return generic === -1 ? type : type.slice(0, generic);
}
function indent(lines: readonly string[]): string[] {
    return lines.map((line) => (line.length === 0 ? line : INDENT + line));
}
interface FunctionScope {
    readonly name: string | null;
    readonly isStatic: boolean;
    readonly accessorOf: string | null;
}
const INITIALIZER_SCOPE: FunctionScope = { name: null, isStatic: false, accessorOf: null };
const STATIC_SCOPE: FunctionScope = { name: null, isStatic: true, accessorOf: null };
class Emitter {
    private readonly classesByTypeName = new Map<string, ClassInfo>();
    private readonly classesByDecl = new Map<ScriptFile | ClassDeclaration, ClassInfo>();
    private cls: ClassInfo;
    private fn: FunctionScope = INITIALIZER_SCOPE;
    private temp = 0;
    constructor(private readonly input: EmitInput) {
        for (const cls of input.program.classes) {
            this.classesByTypeName.set(cls.typeName, cls);
            this.classesByDecl.set(cls.decl, cls);
        }
        this.cls = input.program.main;
    }
    run(): EmitOutput {
        const { program, fileName, source } = this.input;
        const writer = new JsWriter(fileName, source, INDENT);
        const lines: string[] = [`const $ = require("@helix/gdscript").module(helix, require, console, module);`];
        for (const dependency of program.dependencies)
            lines.push(`const ${siblingAlias(dependency)} = $.sibling(${q(dependency)});`);
        lines.push('');
        for (const cls of program.classes) {
            lines.push(...this.classLines(cls));
            lines.push('');
        }
        lines.push(...this.staticInitLines(program.staticInits));
        writer.write(lines.join('\n'));
        return { code: writer.toCode(), sourceMap: writer.toSourceMap() };
    }
    private mark(span: SourceSpan): string {
        return JsWriter.marker(span);
    }
    private nextTemp(prefix: string): string {
        return `$${prefix}${this.temp++}`;
    }
    private classLines(cls: ClassInfo): string[] {
        const previous = this.cls;
        this.cls = cls;
        try {
            const parent = cls.parent ? cls.parent.jsName : `$.base(${q(cls.godotBase)})`;
            const lines: string[] = [`${this.mark(cls.decl.span)}class ${cls.jsName} extends ${parent} {`];
            lines.push(...indent(this.constructorLines(cls)));
            for (const member of cls.decl.members) {
                if (member.kind === 'variable' && member.accessors && !member.isStatic) {
                    lines.push('');
                    lines.push(...indent(this.accessorLines(member)));
                }
                else if (member.kind === 'function') {
                    lines.push('');
                    lines.push(...indent(this.functionLines(member)));
                }
            }
            lines.push('}');
            lines.push(`$.defineClass(${cls.jsName}, ${this.classInfoLiteral(cls)});`);
            for (const inner of cls.inner.values())
                lines.push(`${cls.jsName}.${inner.name} = ${inner.jsName};`);
            return lines;
        }
        finally {
            this.cls = previous;
        }
    }
    private classInfoLiteral(cls: ClassInfo): string {
        const fields = [`name: ${q(cls.name)}`, `base: ${q(cls.godotBase)}`, `isMain: ${cls.isMain}`];
        if (cls.isMain) {
            const file = this.input.file;
            fields.push(`path: ${q(`res://${this.input.fileName}`)}`);
            fields.push(`tool: ${file.isTool}`);
            fields.push(`icon: ${file.icon === null ? 'null' : q(file.icon)}`);
        }
        const exports = this.exportLiterals(cls);
        if (exports.length > 0)
            fields.push(`exports: [${exports.join(', ')}]`);
        return `{ ${fields.join(', ')} }`;
    }
    private exportLiterals(cls: ClassInfo): string[] {
        const literals: string[] = [];
        for (const member of cls.decl.members) {
            if (member.kind !== 'variable' || member.isStatic)
                continue;
            const annotation = member.annotations.find((entry) => entry.name === 'export' || entry.name.startsWith('export_'));
            if (!annotation && !member.exported)
                continue;
            const fields = [`name: ${q(member.name)}`, `type: ${q(member.staticType ?? 'Variant')}`];
            if (annotation && annotation.name !== 'export') {
                fields.push(`hint: ${q(annotation.name.slice('export_'.length))}`);
                const hintString = this.annotationHint(annotation);
                if (hintString !== null)
                    fields.push(`hintString: ${q(hintString)}`);
            }
            const fallback = member.value ? this.literalText(member.value) : null;
            if (fallback !== null)
                fields.push(`default: ${fallback}`);
            literals.push(`{ ${fields.join(', ')} }`);
        }
        return literals;
    }
    private annotationHint(annotation: Annotation): string | null {
        const parts: string[] = [];
        for (const arg of annotation.args) {
            const text = this.literalText(arg);
            if (text === null)
                return null;
            parts.push(arg.kind === 'string' ? arg.value : text);
        }
        return parts.length > 0 ? parts.join(',') : null;
    }
    private literalText(e: Expression): string | null {
        if (e.kind === 'literal')
            return e.literalType === 'null' ? 'null' : String(e.value);
        if (e.kind === 'string')
            return q(e.value);
        if (e.kind === 'unary' && e.operator === '-' && e.operand.kind === 'literal' && typeof e.operand.value === 'number')
            return String(-e.operand.value);
        return null;
    }
    private constructorLines(cls: ClassInfo): string[] {
        const previousFn = this.fn;
        this.fn = INITIALIZER_SCOPE;
        try {
            const body: string[] = ['super($inject);'];
            for (const member of cls.decl.members) {
                if (member.kind === 'signal')
                    body.push(`this.${member.name} = $.signal(this, ${q(member.name)});`);
            }
            const onReady: string[] = [];
            for (const member of cls.decl.members) {
                if (member.kind !== 'variable' || member.isStatic)
                    continue;
                const field = member.accessors ? `${member.name}$` : member.name;
                const value = this.initialValue(member.value, member.staticType ?? 'Variant', member.type, `a variável "${member.name}"`);
                const line = `${this.mark(member.span)}this.${field} = ${value};`;
                if (member.onReady)
                    onReady.push(line);
                else
                    body.push(line);
            }
            if (onReady.length > 0) {
                body.push('this.$onReady.push(() => {');
                body.push(...indent(onReady));
                body.push('});');
            }
            return ['constructor($inject) {', ...indent(body), '}'];
        }
        finally {
            this.fn = previousFn;
        }
    }
    private initialValue(value: Expression | null, type: StaticType, ref: TypeRef | null, what: string): string {
        if (!value)
            return this.defaultValue(type, ref);
        return this.typedValue(value, ref, what);
    }
    private typedValue(value: Expression, ref: TypeRef | null, what: string): string {
        const text = this.copied(value);
        const runtime = ref ? this.runtimeType(ref) : null;
        if (runtime && (value.type ?? 'Variant') === 'Variant')
            return `$.check(${text}, ${runtime}, ${q(what)})`;
        return text;
    }
    private copied(e: Expression): string {
        const text = this.expression(e);
        const type = e.type ?? 'Variant';
        if (VALUE_TYPES.has(type) && (e.kind === 'identifier' || e.kind === 'member' || e.kind === 'index'))
            return `$.T.${type}(${text})`;
        return text;
    }
    private defaultValue(type: StaticType, ref: TypeRef | null): string {
        if (ref?.resolved?.kind === 'enum')
            return '0';
        const base = baseTypeName(type);
        if (base === 'int' || base === 'float')
            return '0';
        if (base === 'bool')
            return 'false';
        if (STRING_TYPES.has(base))
            return '""';
        if (VALUE_TYPES.has(base))
            return `$.T.${base}()`;
        if (base === 'Array')
            return '[]';
        if (base === 'Dictionary')
            return '$.T.Dictionary()';
        if (PACKED_TYPES.has(base))
            return `$.T.${base}()`;
        return 'null';
    }
    private runtimeType(ref: TypeRef): string | null {
        const resolved = ref.resolved;
        if (!resolved)
            return null;
        switch (resolved.kind) {
            case 'builtin':
                return q(resolved.runtimeName);
            case 'class':
                return resolved.jsName;
            case 'enum':
                return q('int');
            default:
                return null;
        }
    }
}
