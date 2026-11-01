import type TS from 'typescript';
import type { CompileDiagnostic } from './compile-types';
import { HELIX_PATH, LIB_DIR, ScriptProjectIndex, type ProjectScript } from './project-index';
export type { ModuleLanguage, ProjectScript, ProjectScriptLanguage } from './project-index';
export { scriptVirtualPath, stripSpecifierExtension } from './project-index';
export interface TypeScriptRuntime {
    readonly ts: typeof TS;
    readonly libs: ReadonlyMap<string, string>;
    readonly version: string;
}
const BUNDLE_URL = '/vendor/typescript/bundle.json';
let runtimePromise: Promise<TypeScriptRuntime> | null = null;
interface LibBundle {
    version: string;
    libs: Record<string, string>;
    messages: Record<string, string>;
}
export function isTypeScriptLoaded(): boolean {
    return loadedRuntime !== null;
}
let loadedRuntime: TypeScriptRuntime | null = null;
export function loadTypeScript(): Promise<TypeScriptRuntime> {
    if (!runtimePromise) {
        runtimePromise = (async () => {
            const [module, response] = await Promise.all([import('typescript'), fetch(BUNDLE_URL)]);
            if (!response.ok)
                throw new Error(`Não foi possível carregar a biblioteca padrão do TypeScript (${response.status} em ${BUNDLE_URL}).`);
            const bundle = (await response.json()) as LibBundle;
            const ts = (module.default ?? module) as typeof TS;
            const localizable = ts as unknown as {
                setLocalizedDiagnosticMessages?: (messages: Record<string, string>) => void;
            };
            localizable.setLocalizedDiagnosticMessages?.(bundle.messages);
            const runtime: TypeScriptRuntime = { ts, libs: new Map(Object.entries(bundle.libs)), version: ts.version };
            loadedRuntime = runtime;
            return runtime;
        })().catch((cause: unknown) => {
            runtimePromise = null;
            throw cause;
        });
    }
    return runtimePromise;
}
export interface TypeScriptEmit {
    readonly code: string | null;
    readonly sourceMap: string | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly dependencies: readonly string[];
}
export interface TypeScriptCheck {
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly dependencies: readonly string[];
}
const OUT_DIR = '/out';
interface VersionedSnapshot extends TS.IScriptSnapshot {
    readonly path: string;
    readonly version: number;
}
export class TypeScriptProject {
    private readonly ts: typeof TS;
    readonly index = new ScriptProjectIndex();
    private readonly fixed = new Map<string, string>();
    private readonly service: TS.LanguageService;
    private readonly options: TS.CompilerOptions;
    constructor(runtime: TypeScriptRuntime, helixDeclarations: string) {
        const { ts } = runtime;
        this.ts = ts;
        for (const [name, text] of runtime.libs)
            this.fixed.set(`${LIB_DIR}${name}`, text);
        this.fixed.set(HELIX_PATH, helixDeclarations);
        this.options = {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.Classic,
            lib: ['lib.es2023.d.ts', 'lib.esnext.disposable.d.ts', 'lib.decorators.d.ts', 'lib.decorators.legacy.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.dom.asynciterable.d.ts'],
            strict: true,
            useUnknownInCatchVariables: false,
            noImplicitReturns: false,
            allowJs: true,
            checkJs: false,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            resolveJsonModule: false,
            isolatedModules: false,
            skipLibCheck: true,
            sourceMap: true,
            inlineSources: false,
            noEmitOnError: false,
            outDir: OUT_DIR,
            removeComments: false,
            importHelpers: false,
            noEmitHelpers: false,
            newLine: ts.NewLineKind.LineFeed,
            types: [],
            typeRoots: [],
        };
        this.service = ts.createLanguageService(this.createHost(), ts.createDocumentRegistry());
    }
    get scriptNames(): string[] {
        return this.index.scriptNames;
    }
    setScript(script: ProjectScript): boolean {
        return this.index.setScript(script);
    }
    removeScript(assetId: string): boolean {
        return this.index.removeScript(assetId);
    }
    retainOnly(assetIds: ReadonlySet<string>): boolean {
        return this.index.retainOnly(assetIds);
    }
    has(assetId: string): boolean {
        return this.index.has(assetId);
    }
    pathOf(assetId: string): string | null {
        return this.index.pathOf(assetId);
    }
    assetOfPath(path: string): {
        assetId: string;
        name: string;
    } | null {
        return this.index.assetOfPath(path);
    }
    textOf(path: string): string | null {
        return this.index.textOf(path) ?? this.fixed.get(path) ?? null;
    }
    check(assetId: string): TypeScriptCheck {
        const path = this.index.pathOf(assetId);
        const file = path ? this.index.file(path) : undefined;
        if (!path || !file)
            return { diagnostics: [], dependencies: [] };
        const raw: TS.Diagnostic[] = [...this.service.getSyntacticDiagnostics(path)];
        if (path.endsWith('.ts'))
            raw.push(...this.service.getSemanticDiagnostics(path));
        const diagnostics = raw.map((diagnostic) => this.convert(diagnostic, file.text)).filter((entry): entry is CompileDiagnostic => entry !== null);
        return { diagnostics, dependencies: this.collectDependencies(path) };
    }
    dependenciesOf(assetId: string): string[] {
        const path = this.index.pathOf(assetId);
        return path ? this.collectDependencies(path) : [];
    }
    get languageService(): TS.LanguageService {
        return this.service;
    }
    compile(assetId: string): TypeScriptEmit {
        const path = this.index.pathOf(assetId);
        const file = path ? this.index.file(path) : undefined;
        if (!path || !file)
            throw new Error(`Script ${assetId} não está no projeto TypeScript.`);
        const { ts } = this;
        const typed = path.endsWith('.ts');
        const raw: TS.Diagnostic[] = [...this.service.getSyntacticDiagnostics(path)];
        if (typed)
            raw.push(...this.service.getSemanticDiagnostics(path));
        const diagnostics = raw.map((diagnostic) => this.convert(diagnostic, file.text)).filter((entry): entry is CompileDiagnostic => entry !== null);
        const dependencies = this.collectDependencies(path);
        const hasSyntaxError = raw.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error && diagnostic.code < 2000);
        if (hasSyntaxError)
            return { code: null, sourceMap: null, diagnostics, dependencies };
        const output = this.service.getEmitOutput(path);
        const js = output.outputFiles.find((entry) => entry.name.endsWith('.js'));
        const map = output.outputFiles.find((entry) => entry.name.endsWith('.js.map'));
        if (!js || output.emitSkipped) {
            return {
                code: null,
                sourceMap: null,
                diagnostics: [...diagnostics, { severity: 'error', message: 'O TypeScript não emitiu código para este script.', line: 1, column: 1, source: 'TypeScript' }],
                dependencies,
            };
        }
        return { code: stripSourceMappingComment(js.text), sourceMap: map?.text ?? null, diagnostics, dependencies };
    }
    private collectDependencies(path: string): string[] {
        const { ts } = this;
        const sourceFile = this.service.getProgram()?.getSourceFile(path);
        if (!sourceFile)
            return [];
        const found = new Set<string>();
        const visit = (node: TS.Node): void => {
            if (ts.isImportDeclaration(node)) {
                if (!node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier))
                    found.add(node.moduleSpecifier.text);
            }
            else if (ts.isExportDeclaration(node)) {
                if (!node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
                    found.add(node.moduleSpecifier.text);
            }
            else if (ts.isImportEqualsDeclaration(node)) {
                if (ts.isExternalModuleReference(node.moduleReference) && ts.isStringLiteral(node.moduleReference.expression))
                    found.add(node.moduleReference.expression.text);
            }
            else if (ts.isCallExpression(node) && node.arguments.length > 0) {
                const callee = node.expression;
                const isImportCall = callee.kind === ts.SyntaxKind.ImportKeyword;
                const isRequireCall = ts.isIdentifier(callee) && callee.text === 'require';
                const [specifier] = node.arguments;
                if ((isImportCall || isRequireCall) && ts.isStringLiteralLike(specifier))
                    found.add(specifier.text);
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return Array.from(found);
    }
    resolveSpecifier(specifier: string): {
        assetId: string;
        path: string;
        name: string;
    } | null {
        return this.index.resolveSpecifier(specifier);
    }
    private convert(diagnostic: TS.Diagnostic, text: string): CompileDiagnostic | null {
        const { ts } = this;
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        let line = 1;
        let column = 1;
        let endLine: number | undefined;
        let endColumn: number | undefined;
        if (diagnostic.file && diagnostic.start !== undefined) {
            const start = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            line = start.line + 1;
            column = start.character + 1;
            if (diagnostic.length !== undefined) {
                const end = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start + diagnostic.length);
                endLine = end.line + 1;
                endColumn = end.character + 1;
            }
        }
        else if (text.length === 0) {
            return null;
        }
        const severity = diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : diagnostic.category === ts.DiagnosticCategory.Warning ? 'warning' : 'info';
        return { severity, message, line, column, endLine, endColumn, code: `TS${diagnostic.code}`, source: 'TypeScript' };
    }
    private snapshotOf(path: string): VersionedSnapshot | undefined {
        const file = this.index.file(path);
        if (!file)
            return undefined;
        const { ts, index } = this;
        const text = file.text;
        const version = file.version;
        return {
            path,
            version,
            getText: (start, end) => text.slice(start, end),
            getLength: () => text.length,
            getChangeRange: (old) => {
                const previous = old as Partial<VersionedSnapshot>;
                if (previous.path !== path || typeof previous.version !== 'number')
                    return undefined;
                const changes = index.changesSince(path, previous.version);
                if (changes === null)
                    return undefined;
                if (changes.length === 0)
                    return ts.createTextChangeRange(ts.createTextSpan(0, 0), 0);
                return ts.collapseTextChangeRangesAcrossMultipleVersions(changes.map((change) => ts.createTextChangeRange(ts.createTextSpan(change.span.start, change.span.length), change.newLength)));
            },
            dispose: () => undefined,
        };
    }
    private createHost(): TS.LanguageServiceHost {
        const { ts, index, fixed } = this;
        const self = this;
        const fileExists = (fileName: string) => index.file(fileName) !== undefined || fixed.has(fileName);
        const host: TS.LanguageServiceHost & {
            getDefaultLibLocation(): string;
        } = {
            getCompilationSettings: () => self.options,
            getProjectVersion: () => String(index.projectVersion),
            getScriptFileNames: () => [...fixed.keys(), ...index.paths],
            getScriptVersion: (fileName) => String(index.file(fileName)?.version ?? (fixed.has(fileName) ? 1 : 0)),
            getScriptSnapshot: (fileName) => {
                const fixedText = fixed.get(fileName);
                if (fixedText !== undefined)
                    return ts.ScriptSnapshot.fromString(fixedText);
                return self.snapshotOf(fileName);
            },
            getCurrentDirectory: () => '/',
            getDefaultLibFileName: () => `${LIB_DIR}lib.es2023.d.ts`,
            getDefaultLibLocation: () => LIB_DIR.replace(/\/$/, ''),
            fileExists,
            readFile: (fileName) => self.textOf(fileName) ?? undefined,
            directoryExists: (directory) => {
                const normalized = directory.endsWith('/') ? directory : `${directory}/`;
                if (normalized === '/')
                    return true;
                for (const path of fixed.keys())
                    if (path.startsWith(normalized))
                        return true;
                for (const path of index.paths)
                    if (path.startsWith(normalized))
                        return true;
                return false;
            },
            getDirectories: () => [],
            useCaseSensitiveFileNames: () => true,
            getNewLine: () => '\n',
            resolveModuleNameLiterals: (literals) => literals.map((literal) => {
                const specifier = literal.text;
                if (specifier === 'helix' || specifier === '@helix/engine') {
                    return { resolvedModule: { resolvedFileName: HELIX_PATH, extension: ts.Extension.Dts, isExternalLibraryImport: false } };
                }
                const path = index.resolvePath(specifier);
                if (!path)
                    return { resolvedModule: undefined };
                const extension = path.endsWith('.d.ts') ? ts.Extension.Dts : path.endsWith('.ts') ? ts.Extension.Ts : ts.Extension.Js;
                return { resolvedModule: { resolvedFileName: path, extension, isExternalLibraryImport: false } };
            }),
        };
        return host;
    }
}
function stripSourceMappingComment(code: string): string {
    return code.replace(/\n?\/\/# sourceMappingURL=.*$/m, '');
}
