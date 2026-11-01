import type { ScriptRunContext } from '../script-document';
export type ModuleLanguage = 'javascript' | 'typescript';
export type ProjectScriptLanguage = ModuleLanguage | 'foreign';
export interface ProjectScript {
    readonly assetId: string;
    readonly name: string;
    readonly language: ProjectScriptLanguage;
    readonly source: string;
    readonly runContext: ScriptRunContext;
}
export const FOREIGN_DECLARATION = 'declare const exports: any\nexport = exports\n';
export const SCRIPTS_DIR = '/scripts/';
export const LIB_DIR = '/lib/';
export const HELIX_PATH = '/helix/index.d.ts';
export function scriptVirtualPath(name: string, language: ProjectScriptLanguage): string {
    const extension = language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : 'd.ts';
    return `${SCRIPTS_DIR}${name}.${extension}`;
}
const SPECIFIER_EXTENSION = /\.(ts|js|mjs|cjs|tsx|jsx|lua|luau|py|gd|json|toml|glsl|frag|vert|wgsl)$/i;
export function stripSpecifierExtension(specifier: string): string {
    return specifier.replace(SPECIFIER_EXTENSION, '');
}
export interface TextChangeRangeLike {
    readonly span: {
        readonly start: number;
        readonly length: number;
    };
    readonly newLength: number;
}
const MAX_CHANGE_HISTORY = 64;
export interface IndexedScript {
    text: string;
    version: number;
    readonly assetId: string;
    readonly changes: TextChangeRangeLike[];
}
export function diffChangeRange(previous: string, next: string): TextChangeRangeLike {
    const max = Math.min(previous.length, next.length);
    let prefix = 0;
    while (prefix < max && previous.charCodeAt(prefix) === next.charCodeAt(prefix))
        prefix++;
    let suffix = 0;
    while (suffix < max - prefix && previous.charCodeAt(previous.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix))
        suffix++;
    return { span: { start: prefix, length: previous.length - prefix - suffix }, newLength: next.length - prefix - suffix };
}
export class ScriptProjectIndex {
    private readonly files = new Map<string, IndexedScript>();
    private readonly pathByAsset = new Map<string, string>();
    private readonly nameByPath = new Map<string, string>();
    projectVersion = 1;
    get scriptNames(): string[] {
        return Array.from(this.nameByPath.values());
    }
    get paths(): IterableIterator<string> {
        return this.files.keys();
    }
    file(path: string): IndexedScript | undefined {
        return this.files.get(path);
    }
    setScript(script: ProjectScript): boolean {
        const path = scriptVirtualPath(script.name, script.language);
        const text = script.language === 'foreign' ? FOREIGN_DECLARATION : script.source;
        const previousPath = this.pathByAsset.get(script.assetId);
        if (previousPath && previousPath !== path)
            this.dropPath(previousPath);
        const existing = this.files.get(path);
        if (existing && existing.assetId === script.assetId && existing.text === text && previousPath === path)
            return false;
        if (existing && existing.assetId === script.assetId) {
            existing.changes.push(diffChangeRange(existing.text, text));
            if (existing.changes.length > MAX_CHANGE_HISTORY)
                existing.changes.splice(0, existing.changes.length - MAX_CHANGE_HISTORY);
            existing.text = text;
            existing.version++;
        }
        else {
            this.files.set(path, { text, version: (existing?.version ?? 0) + 1, assetId: script.assetId, changes: [] });
        }
        this.pathByAsset.set(script.assetId, path);
        this.nameByPath.set(path, script.name);
        this.projectVersion++;
        return true;
    }
    removeScript(assetId: string): boolean {
        const path = this.pathByAsset.get(assetId);
        if (!path)
            return false;
        this.dropPath(path);
        this.pathByAsset.delete(assetId);
        this.projectVersion++;
        return true;
    }
    retainOnly(assetIds: ReadonlySet<string>): boolean {
        let changed = false;
        for (const assetId of Array.from(this.pathByAsset.keys())) {
            if (!assetIds.has(assetId))
                changed = this.removeScript(assetId) || changed;
        }
        return changed;
    }
    has(assetId: string): boolean {
        return this.pathByAsset.has(assetId);
    }
    pathOf(assetId: string): string | null {
        return this.pathByAsset.get(assetId) ?? null;
    }
    assetOfPath(path: string): {
        assetId: string;
        name: string;
    } | null {
        const file = this.files.get(path);
        if (!file)
            return null;
        return { assetId: file.assetId, name: this.nameByPath.get(path) ?? path };
    }
    textOf(path: string): string | null {
        return this.files.get(path)?.text ?? null;
    }
    resolveSpecifier(specifier: string): {
        assetId: string;
        path: string;
        name: string;
    } | null {
        const path = this.resolvePath(specifier);
        if (!path)
            return null;
        const file = this.files.get(path);
        if (!file)
            return null;
        return { assetId: file.assetId, path, name: this.nameByPath.get(path) ?? specifier };
    }
    resolvePath(specifier: string): string | null {
        const trimmed = specifier.trim();
        if (!trimmed)
            return null;
        const cleaned = stripSpecifierExtension(trimmed.replace(/^\.?\//, '').replace(/^scripts\//i, ''));
        const candidates = [`${SCRIPTS_DIR}${cleaned}.ts`, `${SCRIPTS_DIR}${cleaned}.js`, `${SCRIPTS_DIR}${cleaned}.d.ts`];
        for (const candidate of candidates)
            if (this.files.has(candidate))
                return candidate;
        const lower = cleaned.toLowerCase();
        for (const [path, name] of this.nameByPath)
            if (name.toLowerCase() === lower)
                return path;
        const byAsset = this.pathByAsset.get(trimmed);
        return byAsset ?? null;
    }
    changesSince(path: string, fromVersion: number): TextChangeRangeLike[] | null {
        const file = this.files.get(path);
        if (!file)
            return null;
        const missing = file.version - fromVersion;
        if (missing <= 0)
            return [];
        if (missing > file.changes.length)
            return null;
        return file.changes.slice(file.changes.length - missing);
    }
    private dropPath(path: string): void {
        this.files.delete(path);
        this.nameByPath.delete(path);
    }
}
