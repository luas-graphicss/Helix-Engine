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
    private accessorLines(member: VariableMember): string[] {
        const accessors = member.accessors!;
        const field = `${member.name}$`;
        const lines: string[] = [];
        const previousFn = this.fn;
        this.fn = { name: null, isStatic: false, accessorOf: member.name };
        try {
            const getter = accessors.getter;
            if (!getter) {
                lines.push(`get ${member.name}() {`, `${INDENT}return this.${field};`, '}');
            }
            else if (getter.kind === 'named') {
                lines.push(`get ${member.name}() {`, `${INDENT}return this.${getter.name}();`, '}');
            }
            else {
                lines.push(`${this.mark(getter.span)}get ${member.name}() {`, ...indent(this.blockLines(getter.body)), '}');
            }
            const setter = accessors.setter;
            if (!setter) {
                lines.push(`set ${member.name}($value) {`, `${INDENT}this.${field} = $value;`, '}');
            }
            else if (setter.kind === 'named') {
                lines.push(`set ${member.name}($value) {`, `${INDENT}this.${setter.name}($value);`, '}');
            }
            else {
                const param = jsIdentifier(setter.param);
                lines.push(`${this.mark(setter.span)}set ${member.name}(${param}) {`, ...indent(this.blockLines(setter.body)), '}');
            }
            return lines;
        }
        finally {
            this.fn = previousFn;
        }
    }
    private functionLines(member: FunctionMember): string[] {
        const previousFn = this.fn;
        this.fn = { name: member.name, isStatic: member.isStatic, accessorOf: member.accessorOf ?? null };
        try {
            const head = `${this.mark(member.span)}${member.isStatic ? 'static ' : ''}${member.isAsync ? 'async ' : ''}${member.name}(${this.parameterList(member.params)}) {`;
            const body: string[] = this.parameterChecks(member.params, `${member.name}()`);
            if (member.name === '_init' && !member.isStatic && !callsSuper(member.body))
                body.push('super._init();');
            body.push(...this.blockLines(member.body));
            return [head, ...indent(body), '}'];
        }
        finally {
            this.fn = previousFn;
        }
    }
    private parameterList(params: readonly Parameter[]): string {
        return params.map((param) => (param.defaultValue ? `${param.jsName ?? jsIdentifier(param.name)} = ${this.expression(param.defaultValue)}` : (param.jsName ?? jsIdentifier(param.name)))).join(', ');
    }
    private parameterChecks(params: readonly Parameter[], where: string): string[] {
        const lines: string[] = [];
        for (const param of params) {
            if (!param.type)
                continue;
            const runtime = this.runtimeType(param.type);
            if (!runtime)
                continue;
            const name = param.jsName ?? jsIdentifier(param.name);
            lines.push(`${name} = $.check(${name}, ${runtime}, ${q(`o parâmetro "${param.name}" de ${where}`)});`);
        }
        return lines;
    }
    private staticInitLines(inits: readonly StaticInit[]): string[] {
        const lines: string[] = [];
        const emittedEnums = new Set<EnumMember>();
        const previousCls = this.cls;
        const previousFn = this.fn;
        this.fn = STATIC_SCOPE;
        try {
            for (const { owner, member } of inits) {
                this.cls = owner;
                const decl = member.decl;
                if (!decl)
                    continue;
                const target = `${owner.jsName}.${member.name}`;
                if (decl.kind === 'constant') {
                    lines.push(`${this.mark(decl.span)}${target} = ${this.typedValue(decl.value, decl.type, `a constante "${member.name}"`)};`);
                }
                else if (decl.kind === 'enum') {
                    if (decl.name) {
                        const entries = Array.from(member.enumValues ?? [], ([name, value]) => `${q(name)}: ${value}`);
                        lines.push(`${this.mark(decl.span)}${target} = $.enum({ ${entries.join(', ')} });`);
                    }
                    else if (!emittedEnums.has(decl)) {
                        emittedEnums.add(decl);
                        for (const value of decl.values) {
                            const valueMember = owner.members.get(value.name);
                            const number = typeof valueMember?.constValue === 'number' ? valueMember.constValue : 0;
                            lines.push(`${this.mark(value.span)}${owner.jsName}.${value.name} = ${number};`);
                        }
                    }
                }
                else if (decl.kind === 'variable') {
                    lines.push(`${this.mark(decl.span)}${target} = ${this.initialValue(decl.value, decl.staticType ?? 'Variant', decl.type, `a variável "${member.name}"`)};`);
                }
            }
            return lines;
        }
        finally {
            this.cls = previousCls;
            this.fn = previousFn;
        }
    }
    private blockLines(block: Block): string[] {
        const lines: string[] = [];
        for (const statement of block.statements)
            lines.push(...this.statementLines(statement));
        return lines;
    }
    private statementLines(statement: Statement): string[] {
        const at = this.mark(statement.span);
        switch (statement.kind) {
            case 'expression': {
                const e = statement.expression;
                const text = this.expression(e);
                if (e.kind === 'call' && this.mayReturnPromise(e))
                    return [`${at}$.detach(${text});`];
                return [`${at}${text};`];
            }
            case 'assignment':
                return this.assignmentLines(statement, at);
            case 'variable': {
                const name = statement.jsName ?? jsIdentifier(statement.name);
                const value = this.initialValue(statement.value, statement.staticType ?? 'Variant', statement.type, `a variável "${statement.name}"`);
                return [`${at}let ${name} = ${value};`];
            }
            case 'constant': {
                const name = statement.jsName ?? jsIdentifier(statement.name);
                return [`${at}const ${name} = ${this.typedValue(statement.value, statement.type, `a constante "${statement.name}"`)};`];
            }
            case 'if': {
                const lines = [`${at}if (${this.condition(statement.condition)}) {`, ...indent(this.blockLines(statement.then))];
                let otherwise = statement.otherwise;
                while (otherwise) {
                    const only = otherwise.statements.length === 1 ? otherwise.statements[0] : null;
                    if (only && only.kind === 'if') {
                        lines.push(`} else ${this.mark(only.span)}if (${this.condition(only.condition)}) {`, ...indent(this.blockLines(only.then)));
                        otherwise = only.otherwise;
                        continue;
                    }
                    lines.push('} else {', ...indent(this.blockLines(otherwise)));
                    break;
                }
                lines.push('}');
                return lines;
            }
            case 'while':
                return [`${at}while (${this.condition(statement.condition)}) {`, ...indent(this.blockLines(statement.body)), '}'];
            case 'for': {
                const name = statement.jsName ?? jsIdentifier(statement.variable);
                const iterableType = statement.iterable.type ?? 'Variant';
                const iterable = this.expression(statement.iterable);
                const head = isNumeric(iterableType)
                    ? `for (let ${name} = 0, $end = Math.ceil(${iterable}); ${name} < $end; ${name}++) {`
                    : `for (let ${name} of $.iter(${iterable}, ${q(this.describe(statement.iterable))})) {`;
                return [`${at}${head}`, ...indent(this.blockLines(statement.body)), '}'];
            }
            case 'match':
                return this.matchLines(statement, at);
            case 'return':
                return [statement.value ? `${at}return ${this.copied(statement.value)};` : `${at}return;`];
            case 'break':
                return [`${at}break;`];
            case 'continue':
                return [`${at}continue;`];
            case 'pass':
                return [];
            case 'breakpoint':
                return [`${at}debugger;`];
            case 'assert':
                return [`${at}$.assert(${this.expression(statement.condition)}${statement.message ? `, ${this.expression(statement.message)}` : ''});`];
        }
    }
    private mayReturnPromise(e: CallExpression): boolean {
        const callee = e.callee;
        if (callee.kind === 'identifier') {
            const resolution = callee.resolved;
            if (resolution?.kind === 'member' && resolution.memberKind === 'func')
                return this.isAsyncMember(this.cls, callee.name);
            if (resolution?.kind === 'local' || resolution?.kind === 'helix')
                return true;
            return false;
        }
        if (callee.kind === 'member') {
            const resolution = callee.memberResolution;
            if (resolution?.kind === 'member' && resolution.memberKind === 'func') {
                const owner = this.classByJsName(resolution.owner);
                return owner ? this.isAsyncMember(owner, callee.name) : true;
            }
            if (resolution)
                return false;
            const objectType = callee.object.type ?? 'Variant';
            return objectType === 'Variant' || objectType === 'Object' || objectType === 'Node' || objectType.startsWith('@class:') || isGodotNodeClass(objectType);
        }
        return callee.kind !== 'super' && (e.type ?? 'Variant') === 'Variant';
    }
    private isAsyncMember(cls: ClassInfo, name: string): boolean {
        for (let current: ClassInfo | null = cls; current; current = current.parent) {
            const member = current.members.get(name);
            if (member)
                return member.func?.isAsync ?? false;
        }
        return false;
    }
    private classByJsName(jsName: string): ClassInfo | null {
        for (const cls of this.input.program.classes)
            if (cls.jsName === jsName)
                return cls;
        return null;
    }
    private condition(e: Expression): string {
        return this.truthy(e);
    }
    private truthy(e: Expression): string {
        const text = this.expression(e);
        return e.type === 'bool' ? text : `$.truthy(${text})`;
    }
    private assignmentLines(statement: AssignmentStatement, at: string): string[] {
        const target = statement.target;
        const operator = statement.operator;
        const compound = operator === '=' ? null : (operator.slice(0, -1) as BinaryExpression['operator']);
        if (target.kind === 'identifier') {
            const place = this.identifierPlace(target);
            const value = compound ? this.combined(compound, place, target.type ?? 'Variant', statement.value) : this.copied(statement.value);
            return [`${at}${place} = ${value};`];
        }
        if (target.kind === 'member') {
            const value = (current: string): string => (compound ? this.combined(compound, current, target.type ?? 'Variant', statement.value) : this.copied(statement.value));
            const object = target.object;
            const objectType = object.type ?? 'Variant';
            const where = q(this.describe(object));
            const chain = VALUE_TYPES.has(objectType) || objectType === 'Variant' ? this.chainOf(object) : null;
            if (chain) {
                const current = `$.get($.get(${chain.root}, ${q(chain.inner)}, ${where}), ${q(target.name)}, ${where})`;
                return [`${at}$.setChain(${chain.root}, ${q(chain.inner)}, ${q(target.name)}, ${value(current)}, ${where});`];
            }
            const direct = this.memberPlace(target);
            if (direct)
                return [`${at}${direct} = ${value(direct)};`];
            const objectText = this.expression(object);
            if (compound) {
                const temp = this.nextTemp('o');
                return [`${at}{ const ${temp} = ${objectText}; $.set(${temp}, ${q(target.name)}, ${value(`$.get(${temp}, ${q(target.name)}, ${where})`)}, ${where}); }`];
            }
            return [`${at}$.set(${objectText}, ${q(target.name)}, ${this.copied(statement.value)}, ${where});`];
        }
        if (target.kind === 'index') {
            const where = q(this.describe(target.object));
            if (!compound)
                return [`${at}$.setIndex(${this.expression(target.object)}, ${this.expression(target.index)}, ${this.copied(statement.value)}, ${where});`];
            const object = this.nextTemp('o');
            const key = this.nextTemp('k');
            const current = `$.index(${object}, ${key}, ${where})`;
            return [`${at}{ const ${object} = ${this.expression(target.object)}, ${key} = ${this.expression(target.index)}; $.setIndex(${object}, ${key}, ${this.combined(compound, current, target.type ?? 'Variant', statement.value)}, ${where}); }`];
        }
        return [`${at}${this.expression(target)} = ${this.expression(statement.value)};`];
    }
    private combined(operator: BinaryExpression['operator'], current: string, currentType: StaticType, value: Expression): string {
        return this.binaryText(operator, current, currentType, this.expression(value), value.type ?? 'Variant');
    }
    private identifierPlace(e: IdentifierExpression): string {
        const resolution = e.resolved;
        if (!resolution)
            return jsIdentifier(e.name);
        switch (resolution.kind) {
            case 'local':
                return resolution.jsName;
            case 'member':
                return this.memberPlaceOf(resolution, 'this');
            case 'base':
                return `this.${resolution.name}`;
            case 'helix':
                return 'helix';
            default:
                return jsIdentifier(e.name);
        }
    }
}
