import { completionStatus, type Completion, type CompletionContext, type CompletionResult, type CompletionSource } from '@codemirror/autocomplete';
import { EditorSelection, Prec, StateEffect, StateField, type ChangeSpec, type Extension, type Text } from '@codemirror/state';
import { Decoration, EditorView, hoverTooltip, keymap, showTooltip, type DecorationSet, type Tooltip, type ViewUpdate } from '@codemirror/view';
import type TS from 'typescript';
import { loadScriptAsset, openScriptAssetInEditor } from '@/engine/editor/operations/script-operations';
import { displayPartsToString, type FormatOptions } from '@/engine/scripting/compiler/typescript-protocol';
import type { TypeScriptWorkerProject } from '@/engine/scripting/compiler/typescript-worker-client';
import { scriptLanguage } from '@/engine/scripting/script-languages';
import { sourceInputOf } from '../verification/live-verifier';
import type { IntelligenceHost } from './create-intelligence';
import { infoNode, renderDocText } from './doc-dom';
import type { LanguageIntelligence } from './language-intelligence';
const LOG_SOURCE = 'Código';
const KIND_TYPE: Readonly<Record<string, string>> = {
    method: 'method',
    function: 'function',
    'local function': 'function',
    construct: 'function',
    call: 'function',
    property: 'property',
    getter: 'property',
    setter: 'property',
    'JSX attribute': 'property',
    var: 'variable',
    let: 'variable',
    'local var': 'variable',
    parameter: 'variable',
    alias: 'variable',
    using: 'variable',
    'await using': 'variable',
    const: 'constant',
    class: 'class',
    'local class': 'class',
    interface: 'interface',
    type: 'type',
    'type parameter': 'type',
    'primitive type': 'type',
    enum: 'enum',
    'enum member': 'enum',
    module: 'namespace',
    'external module name': 'namespace',
    script: 'namespace',
    keyword: 'keyword',
    string: 'text',
    directory: 'text',
};
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const SPECIFIER_BEFORE = /(?:\bfrom|\bimport|\brequire\s*\(|\bimport\s*\()\s*(['"`])([^'"`]*)$/;
function boostOf(sortText: string): number {
    const deprecated = sortText.startsWith('z');
    const rank = Number.parseInt(sortText.replace(/^z/, ''), 10);
    const base = Number.isFinite(rank) ? (15 - rank) * 8 : 0;
    return Math.max(-99, Math.min(99, deprecated ? base - 60 : base));
}
function lineOf(text: string, offset: number): number {
    let line = 1;
    for (let index = 0; index < offset && index < text.length; index++)
        if (text.charCodeAt(index) === 10)
            line++;
    return line;
}
function applySpans(text: string, spans: readonly {
    start: number;
    length: number;
    newText: string;
}[]): string {
    const sorted = [...spans].sort((a, b) => b.start - a.start);
    let result = text;
    for (const span of sorted)
        result = result.slice(0, span.start) + span.newText + result.slice(span.start + span.length);
    return result;
}
interface SignatureHelp {
    readonly pos: number;
    readonly items: TS.SignatureHelpItems;
    readonly selected: number;
}
const setSignatureHelp = StateEffect.define<SignatureHelp | null>();
const setTransientTooltip = StateEffect.define<Tooltip | null>();
interface RenameSession {
    readonly tooltip: Tooltip;
    readonly decorations: DecorationSet;
}
const setRename = StateEffect.define<RenameSession | null>();
const renameMark = Decoration.mark({ class: 'hx-rename-field' });
const transientField = StateField.define<Tooltip | null>({
    create: () => null,
    update(value, transaction) {
        for (const effect of transaction.effects)
            if (effect.is(setTransientTooltip))
                return effect.value;
        if (value && (transaction.docChanged || transaction.selection))
            return null;
        return value;
    },
    provide: (field) => showTooltip.from(field),
});
const renameField = StateField.define<RenameSession | null>({
    create: () => null,
    update(value, transaction) {
        for (const effect of transaction.effects)
            if (effect.is(setRename))
                return effect.value;
        if (value && transaction.docChanged)
            return null;
        return value;
    },
    provide: (field) => [showTooltip.from(field, (session) => session?.tooltip ?? null), EditorView.decorations.from(field, (session) => session?.decorations ?? Decoration.none)],
});
function textNode(text: string): globalThis.Text {
    return document.createTextNode(text);
}
export async function createTypeScriptIntelligence(host: IntelligenceHost): Promise<LanguageIntelligence> {
    const project = await host.session.scripts.compiler.ensureProject();
    return new TypeScriptIntelligence(host, project);
}
class TypeScriptIntelligence implements LanguageIntelligence {
    readonly completionSources: readonly CompletionSource[];
    readonly extensions: Extension;
    private readonly signatureField: StateField<SignatureHelp | null>;
    private signatureTimer: ReturnType<typeof setTimeout> | null = null;
    private signatureRequest = 0;
    private lastSyncedDoc: Text | null = null;
    private disposed = false;
    constructor(private readonly host: IntelligenceHost, private readonly project: TypeScriptWorkerProject) {
        this.signatureField = StateField.define<SignatureHelp | null>({
            create: () => null,
            update(value, transaction) {
                for (const effect of transaction.effects)
                    if (effect.is(setSignatureHelp))
                        return effect.value;
                if (value && transaction.docChanged)
                    return { ...value, pos: transaction.changes.mapPos(value.pos) };
                return value;
            },
            provide: (field) => showTooltip.from(field, (help) => (help ? { pos: help.pos, above: true, create: () => ({ dom: renderSignatureHelp(help) }) } : null)),
        });
        this.completionSources = [this.moduleSpecifierCompletions, this.completions];
        this.extensions = [
            this.signatureField,
            transientField,
            renameField,
            hoverTooltip(this.hover, { hoverTime: 320 }),
            EditorView.updateListener.of(this.onUpdate),
            Prec.highest(keymap.of(this.signatureKeys())),
        ];
    }
    private sync(doc: Text): string | null {
        const { session, assetId } = this.host;
        const tab = session.code.tab(assetId);
        if (!tab)
            return null;
        if (doc !== this.lastSyncedDoc) {
            session.scripts.compiler.updateLiveSource(sourceInputOf(tab, doc.toString()));
            this.lastSyncedDoc = doc;
        }
        return this.project.pathOf(assetId);
    }
    private formatOptions(): FormatOptions {
        const { indent } = scriptLanguage(this.host.language);
        return { indentSize: indent.size, useTabs: indent.useTabs };
    }
    private docText(documentation: readonly TS.SymbolDisplayPart[] | undefined, tags: readonly TS.JSDocTagInfo[] | undefined): string {
        const main = displayPartsToString(documentation);
        const extra = (tags ?? []).map((tag) => `@${tag.name}${tag.text ? ` ${displayPartsToString(tag.text)}` : ''}`);
        return [main, ...extra].filter(Boolean).join('\n\n');
    }
    private readonly completions: CompletionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
        const word = context.matchBefore(/[\w$]*/);
        const afterDot = context.pos > 0 && context.state.sliceDoc(context.pos - 1, context.pos) === '.';
        if (!context.explicit && !word?.text && !afterDot)
            return null;
        const path = this.sync(context.state.doc);
        if (!path)
            return null;
        let info: TS.WithMetadata<TS.CompletionInfo> | null;
        try {
            info = await this.project.completions(path, context.pos, afterDot && !word?.text ? '.' : null);
        }
        catch (cause) {
            console.warn('[helix] sugestões do TypeScript falharam:', cause);
            return null;
        }
        if (context.aborted || this.disposed)
            return null;
        if (!info || info.entries.length === 0)
            return null;
        if (info.isNewIdentifierLocation && !info.isMemberCompletion && !context.explicit)
            return null;
        const from = word?.from ?? context.pos;
        const requestPos = context.pos;
        const options: Completion[] = [];
        for (const entry of info.entries) {
            if (entry.kind === 'warning')
                continue;
            const option: Completion = {
                label: entry.name,
                type: KIND_TYPE[entry.kind] ?? 'variable',
                boost: boostOf(entry.sortText),
                info: () => this.completionInfo(path, requestPos, entry),
            };
            const sourceLabel = entry.sourceDisplay ? displayPartsToString(entry.sourceDisplay) : entry.source;
            const detail = entry.labelDetails?.description ?? (entry.source ? sourceLabel : undefined) ?? entry.labelDetails?.detail;
            if (detail)
                option.detail = detail;
            if (entry.source || entry.hasAction || entry.insertText || entry.replacementSpan) {
                option.apply = (view, _completion, applyFrom, applyTo) => this.applyEntry(view, path, entry, applyFrom, applyTo);
            }
            options.push(option);
        }
        return { from, options, validFor: /^[\w$]*$/ };
    };
    private async completionInfo(path: string, pos: number, entry: TS.CompletionEntry): Promise<HTMLElement | null> {
        try {
            const details = await this.project.completionDetails(path, pos, entry, this.formatOptions());
            if (!details || this.disposed)
                return null;
            return infoNode({ signature: displayPartsToString(details.displayParts), doc: this.docText(details.documentation, details.tags) });
        }
        catch {
            return null;
        }
    }
    private applyEntry(view: EditorView, path: string, entry: TS.CompletionEntry, from: number, to: number): void {
        const insert = entry.insertText ?? entry.name;
        const replaceFrom = entry.replacementSpan ? entry.replacementSpan.start : from;
        const replaceTo = entry.replacementSpan ? entry.replacementSpan.start + entry.replacementSpan.length : to;
        const changeSet = view.state.changes([{ from: replaceFrom, to: replaceTo, insert }]);
        const cursor = changeSet.mapPos(replaceTo, 1);
        view.dispatch({ changes: changeSet, selection: EditorSelection.cursor(cursor), userEvent: 'input.complete', scrollIntoView: true });
        if (!(entry.source || entry.hasAction))
            return;
        const inserted = view.state.doc;
        const insertedFrom = changeSet.mapPos(replaceFrom, -1);
        void this.applyImportActions(view, path, cursor, entry, insertedFrom, cursor, inserted);
    }
    private async applyImportActions(view: EditorView, path: string, pos: number, entry: TS.CompletionEntry, insertedFrom: number, insertedTo: number, doc: Text): Promise<void> {
        if (!this.sync(doc))
            return;
        let details: TS.CompletionEntryDetails | null;
        try {
            details = await this.project.completionDetails(path, pos, entry, this.formatOptions());
        }
        catch (cause) {
            console.warn('[helix] auto-import do TypeScript falhou:', cause);
            return;
        }
        if (this.disposed || !details || view.state.doc !== doc)
            return;
        const changes: ChangeSpec[] = [];
        for (const action of details.codeActions ?? []) {
            for (const change of action.changes) {
                if (change.fileName !== path)
                    continue;
                for (const textChange of change.textChanges) {
                    const start = textChange.span.start;
                    const end = start + textChange.span.length;
                    if (end > insertedFrom && start < insertedTo)
                        continue;
                    changes.push({ from: start, to: end, insert: textChange.newText });
                }
            }
        }
        if (changes.length === 0)
            return;
        view.dispatch({ changes, userEvent: 'input.complete' });
    }
}
