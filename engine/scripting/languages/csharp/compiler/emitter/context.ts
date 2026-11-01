import { JsWriter } from '../../../../compiler/js-writer';
import { siblingAlias, type ClassInfo, type EnumInfo, type ProgramInfo } from '../analyzer';
import type { CompilationUnit, StaticType } from '../ast';
import type { SourceSpan } from '../tokens';
export interface EmitInput {
    readonly unit: CompilationUnit;
    readonly program: ProgramInfo;
    readonly fileName: string;
    readonly scriptName: string;
    readonly source: string;
}
export interface EmitOutput {
    readonly code: string;
    readonly sourceMap: string;
}
export interface FunctionScope {
    readonly isStatic: boolean;
    readonly isConstructor: boolean;
}
export type BreakTarget = {
    readonly kind: 'loop';
} | {
    readonly kind: 'switch';
    readonly label: string;
};
export const INDENT = '  ';
export const INSTANCE_SCOPE: FunctionScope = { isStatic: false, isConstructor: false };
export const STATIC_SCOPE: FunctionScope = { isStatic: true, isConstructor: false };
export const CONSTRUCTOR_SCOPE: FunctionScope = { isStatic: false, isConstructor: true };
export class EmitContext {
    readonly program: ProgramInfo;
    private readonly classesByJsName = new Map<string, ClassInfo>();
    private readonly enumsByJsName = new Map<string, EnumInfo>();
    private readonly breakTargets: BreakTarget[] = [];
    private readonly catchVariables: string[] = [];
    private temp = 0;
    cls: ClassInfo | null;
    fn: FunctionScope = INSTANCE_SCOPE;
    constructor(readonly input: EmitInput) {
        this.program = input.program;
        for (const cls of input.program.classes)
            this.classesByJsName.set(cls.jsName, cls);
        for (const info of input.program.enums)
            this.enumsByJsName.set(info.jsName, info);
        this.cls = input.program.main;
    }
    mark(span: SourceSpan): string {
        return JsWriter.marker(span);
    }
    nextTemp(prefix: string): string {
        return `$${prefix}${++this.temp}`;
    }
    withClass<T>(cls: ClassInfo, fn: () => T): T {
        const previous = this.cls;
        this.cls = cls;
        try {
            return fn();
        }
        finally {
            this.cls = previous;
        }
    }
    withFunction<T>(scope: FunctionScope, fn: () => T): T {
        const previous = this.fn;
        this.fn = scope;
        try {
            return fn();
        }
        finally {
            this.fn = previous;
        }
    }
    withBreakTarget<T>(target: BreakTarget, fn: () => T): T {
        this.breakTargets.push(target);
        try {
            return fn();
        }
        finally {
            this.breakTargets.pop();
        }
    }
    breakStatement(): string {
        const target = this.breakTargets[this.breakTargets.length - 1];
        return target?.kind === 'switch' ? `break ${target.label};` : 'break;';
    }
    withCatchVariable<T>(variable: string, fn: () => T): T {
        this.catchVariables.push(variable);
        try {
            return fn();
        }
        finally {
            this.catchVariables.pop();
        }
    }
    currentCatchVariable(): string | null {
        return this.catchVariables[this.catchVariables.length - 1] ?? null;
    }
    classByJsName(jsName: string): ClassInfo | null {
        return this.classesByJsName.get(jsName) ?? null;
    }
    enumByJsName(jsName: string): EnumInfo | null {
        return this.enumsByJsName.get(jsName) ?? null;
    }
    classOfType(type: StaticType | undefined): ClassInfo | null {
        if (!type || type.kind !== 'class' || type.runtime)
            return null;
        if (type.jsName) {
            const local = this.classesByJsName.get(type.jsName);
            if (local)
                return local;
        }
        for (const cls of this.program.classes) {
            for (let current: ClassInfo | null = cls; current; current = current.base) {
                if (current.name === type.name && current.script === type.script)
                    return current;
            }
        }
        return null;
    }
    typeReference(jsName: string, sibling: string | null): string {
        if (sibling === null)
            return jsName;
        const [root, ...nested] = jsNameSegments(jsName);
        const alias = `${siblingAlias(sibling, root.replace(/\$$/, ''))}()`;
        return nested.reduce((text, segment) => `${text}.${segment.replace(/\$$/, '')}`, alias);
    }
}
export function jsNameSegments(jsName: string): string[] {
    const segments: string[] = [];
    for (const part of jsName.split('$')) {
        if (part.length === 0 && segments.length > 0)
            segments[segments.length - 1] += '$';
        else
            segments.push(part);
    }
    return segments;
}
export function q(text: string): string {
    return JSON.stringify(text);
}
export function indent(lines: readonly string[]): string[] {
    const out: string[] = [];
    for (const entry of lines) {
        for (const line of entry.split('\n'))
            out.push(line.length === 0 ? line : INDENT + line);
    }
    return out;
}
export function unique(names: readonly string[]): string[] {
    return Array.from(new Set(names));
}
