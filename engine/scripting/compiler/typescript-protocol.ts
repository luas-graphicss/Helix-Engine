import type TS from 'typescript';
import type { InstrumentOutput } from './debug-instrument';
import type { ProjectScript } from './project-index';
import type { DecodedSourceMap } from './source-map';
import type { TypeScriptCheck, TypeScriptEmit } from './typescript-service';
export interface FormatOptions {
    readonly indentSize: number;
    readonly useTabs: boolean;
}
export type TypeScriptMutation = {
    readonly kind: 'set';
    readonly script: ProjectScript;
} | {
    readonly kind: 'remove';
    readonly assetId: string;
} | {
    readonly kind: 'retainOnly';
    readonly assetIds: readonly string[];
};
export type TypeScriptQuery = {
    readonly kind: 'init';
} | {
    readonly kind: 'check';
    readonly assetId: string;
} | {
    readonly kind: 'compile';
    readonly assetId: string;
} | {
    readonly kind: 'dependencies';
    readonly assetId: string;
} | {
    readonly kind: 'completions';
    readonly path: string;
    readonly pos: number;
    readonly triggerCharacter: '.' | null;
} | {
    readonly kind: 'completionDetails';
    readonly path: string;
    readonly pos: number;
    readonly name: string;
    readonly source: string | undefined;
    readonly data: TS.CompletionEntryData | undefined;
    readonly format: FormatOptions;
} | {
    readonly kind: 'quickInfo';
    readonly path: string;
    readonly pos: number;
} | {
    readonly kind: 'signatureHelp';
    readonly path: string;
    readonly pos: number;
    readonly reason: TS.SignatureHelpTriggerReason;
} | {
    readonly kind: 'format';
    readonly path: string;
    readonly format: FormatOptions;
} | {
    readonly kind: 'definition';
    readonly path: string;
    readonly pos: number;
} | {
    readonly kind: 'renameInfo';
    readonly path: string;
    readonly pos: number;
} | {
    readonly kind: 'renameLocations';
    readonly path: string;
    readonly pos: number;
} | {
    readonly kind: 'text';
    readonly path: string;
} | {
    readonly kind: 'instrument';
    readonly code: string;
    readonly sourceMap: DecodedSourceMap | null;
    readonly reserved: readonly string[];
} | {
    readonly kind: 'clear';
};
export type TypeScriptRequest = TypeScriptMutation | (TypeScriptQuery & {
    readonly id: number;
});
export interface TypeScriptResults {
    init: {
        readonly version: string;
    };
    check: TypeScriptCheck;
    compile: TypeScriptEmit;
    dependencies: readonly string[];
    completions: TS.WithMetadata<TS.CompletionInfo> | null;
    completionDetails: TS.CompletionEntryDetails | null;
    quickInfo: TS.QuickInfo | null;
    signatureHelp: TS.SignatureHelpItems | null;
    format: readonly TS.TextChange[];
    definition: readonly TS.DefinitionInfo[];
    renameInfo: TS.RenameInfo;
    renameLocations: readonly TS.RenameLocation[];
    text: string | null;
    instrument: InstrumentOutput | null;
    clear: null;
}
export type TypeScriptQueryKind = TypeScriptQuery['kind'];
export type TypeScriptReply = {
    readonly id: number;
    readonly ok: true;
    readonly result: TypeScriptResults[TypeScriptQueryKind];
} | {
    readonly id: number;
    readonly ok: false;
    readonly error: string;
};
export function displayPartsToString(parts: readonly TS.SymbolDisplayPart[] | undefined): string {
    if (!parts || parts.length === 0)
        return '';
    let text = '';
    for (const part of parts)
        text += part.text;
    return text;
}
