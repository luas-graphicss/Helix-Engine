import { HOOK_NAMES, hookNameOf, toSnakeCase } from '../languages/foreign-values';
import type { HookName } from '../runtime/script-instance';
export interface HookDefinition {
    readonly hook: HookName;
    readonly line: number;
}
function pascalCase(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
}
const ALL_HOOK_SPELLINGS: readonly string[] = HOOK_NAMES.flatMap((hook) => [hook, toSnakeCase(hook), pascalCase(hook)]);
const HOOK_PATTERN = new RegExp(`(^|[^\\w$])(${ALL_HOOK_SPELLINGS.join('|')})(?![\\w$])`);
const DEFINITION_BEFORE = /(^|[^\w$])(function|def|fn|func|fun|void|static|public|private|protected|internal|pub|local|export|sub|override|proc|extern|int|bool|float|double|auto|virtual|final)(?![\w$])|@_cdecl|\(func\s+\$$/;
const DEFINITION_AFTER = /^\s*(=|:)\s*(async\s+)?(function|fn|func|\(|\w+\s*=>)/;
function canonicalHook(spelling: string): HookName | null {
    const direct = hookNameOf(spelling);
    if (direct)
        return direct;
    return hookNameOf(spelling.charAt(0).toLowerCase() + spelling.slice(1));
}
export function scanHookDefinitions(source: string): HookDefinition[] {
    const definitions: HookDefinition[] = [];
    const lines = source.split('\n');
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (/^\s*(\/\/|--|#|;;|\*)/.test(line))
            continue;
        const match = HOOK_PATTERN.exec(line);
        if (!match)
            continue;
        const hook = canonicalHook(match[2]);
        if (!hook)
            continue;
        const nameStart = match.index + match[1].length;
        const before = line.slice(0, nameStart);
        const after = line.slice(nameStart + match[2].length);
        const isDefinition = DEFINITION_BEFORE.test(before) || DEFINITION_AFTER.test(after) || /\(func\s+\$\s*$/.test(before);
        if (!isDefinition)
            continue;
        definitions.push({ hook, line: index + 1 });
    }
    return definitions;
}
export function hookContainingLine(definitions: readonly HookDefinition[], line: number): HookDefinition | null {
    let best: HookDefinition | null = null;
    for (const definition of definitions) {
        if (definition.line > line)
            break;
        best = definition;
    }
    return best;
}
