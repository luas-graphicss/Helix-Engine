import type TS from 'typescript';
import { HELIX_DECLARATIONS } from '../typings/helix-dts';
import { instrumentForDebug } from './debug-instrument';
import type { FormatOptions, TypeScriptMutation, TypeScriptQuery, TypeScriptReply, TypeScriptRequest, TypeScriptResults } from './typescript-protocol';
import { loadTypeScript, TypeScriptProject } from './typescript-service';
const scope = self as unknown as DedicatedWorkerGlobalScope;
const PREFERENCES: TS.UserPreferences = {
    includeCompletionsForModuleExports: true,
    includeCompletionsForImportStatements: true,
    includeCompletionsWithInsertText: true,
    includeAutomaticOptionalChainCompletions: true,
    includeCompletionsWithSnippetText: false,
    includeCompletionsWithClassMemberSnippets: false,
    useLabelDetailsInCompletionEntries: true,
    importModuleSpecifierPreference: 'shortest',
    importModuleSpecifierEnding: 'minimal',
    allowRenameOfImportPath: false,
    providePrefixAndSuffixTextForRename: false,
    quotePreference: 'auto',
};
let ts: typeof TS | null = null;
let project: TypeScriptProject | null = null;
let version = '';
let initializing: Promise<void> | null = null;
function ensureProject(): Promise<void> {
    if (!initializing) {
        initializing = loadTypeScript().then((runtime) => {
            ts = runtime.ts;
            version = runtime.version;
            project = new TypeScriptProject(runtime, HELIX_DECLARATIONS);
        });
        initializing.catch(() => {
            initializing = null;
        });
    }
    return initializing;
}
function formatSettings(options: FormatOptions): TS.FormatCodeSettings {
    const compiler = ts!;
    return {
        ...compiler.getDefaultFormatCodeSettings('\n'),
        indentSize: options.indentSize,
        tabSize: options.indentSize,
        convertTabsToSpaces: !options.useTabs,
        indentStyle: compiler.IndentStyle.Smart,
        semicolons: compiler.SemicolonPreference.Ignore,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
    };
}
function applyMutation(mutation: TypeScriptMutation): void {
    const current = project!;
    switch (mutation.kind) {
        case 'set':
            current.setScript(mutation.script);
            return;
        case 'remove':
            current.removeScript(mutation.assetId);
            return;
        case 'retainOnly':
            current.retainOnly(new Set(mutation.assetIds));
            return;
    }
}
function answer<K extends TypeScriptQuery['kind']>(query: TypeScriptQuery & {
    kind: K;
}): TypeScriptResults[K];
function answer(query: TypeScriptQuery): TypeScriptResults[TypeScriptQuery['kind']] {
    const current = project!;
    const compiler = ts!;
    const service = current.languageService;
    switch (query.kind) {
        case 'init':
            return { version };
        case 'check':
            return current.check(query.assetId);
        case 'compile':
            return current.compile(query.assetId);
        case 'dependencies':
            return current.dependenciesOf(query.assetId);
        case 'completions':
            return (service.getCompletionsAtPosition(query.path, query.pos, {
                ...PREFERENCES,
                triggerKind: query.triggerCharacter ? compiler.CompletionTriggerKind.TriggerCharacter : compiler.CompletionTriggerKind.Invoked,
                triggerCharacter: query.triggerCharacter ?? undefined,
            }) ?? null);
        case 'completionDetails':
            return service.getCompletionEntryDetails(query.path, query.pos, query.name, formatSettings(query.format), query.source, PREFERENCES, query.data) ?? null;
        case 'quickInfo':
            return service.getQuickInfoAtPosition(query.path, query.pos) ?? null;
        case 'signatureHelp':
            return service.getSignatureHelpItems(query.path, query.pos, { triggerReason: query.reason }) ?? null;
        case 'format':
            return service.getFormattingEditsForDocument(query.path, formatSettings(query.format));
        case 'definition':
            return service.getDefinitionAndBoundSpan(query.path, query.pos)?.definitions ?? [];
        case 'renameInfo':
            return service.getRenameInfo(query.path, query.pos, PREFERENCES);
        case 'renameLocations':
            return service.findRenameLocations(query.path, query.pos, false, false, PREFERENCES) ?? [];
        case 'text':
            return current.textOf(query.path);
        case 'instrument':
            return instrumentForDebug(compiler, query.code, query.sourceMap, query.reserved);
        case 'clear':
            current.retainOnly(new Set());
            return null;
    }
}
function reply(message: TypeScriptReply): void {
    scope.postMessage(message);
}
let queue: Promise<void> = Promise.resolve();
function handle(request: TypeScriptRequest): Promise<void> {
    return ensureProject().then(() => {
        if (!('id' in request)) {
            applyMutation(request);
            return;
        }
        try {
            reply({ id: request.id, ok: true, result: answer(request) });
        }
        catch (cause) {
            reply({ id: request.id, ok: false, error: cause instanceof Error ? cause.message : String(cause) });
        }
    }, (cause: unknown) => {
        if ('id' in request)
            reply({ id: request.id, ok: false, error: cause instanceof Error ? cause.message : String(cause) });
    });
}
scope.onmessage = (event: MessageEvent<TypeScriptRequest>) => {
    const request = event.data;
    queue = queue.then(() => handle(request));
};
void ensureProject().catch(() => undefined);
