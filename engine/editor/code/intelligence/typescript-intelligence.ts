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
    private readonly moduleSpecifierCompletions: CompletionSource = (context: CompletionContext): CompletionResult | null => {
        const line = context.state.doc.lineAt(context.pos);
        const match = SPECIFIER_BEFORE.exec(line.text.slice(0, context.pos - line.from));
        if (!match)
            return null;
        const partial = match[2];
        const own = this.host.scriptName();
        const { library } = this.host.session;
        const languageByName = new Map<string, string>();
        for (const asset of library.byKind('script')) {
            if (asset.details.kind === 'script')
                languageByName.set(asset.name, scriptLanguage(asset.details.language).label);
        }
        const options: Completion[] = [{ label: 'helix', type: 'namespace', detail: 'API da engine', boost: 99 }];
        for (const name of this.project.scriptNames) {
            if (name === own)
                continue;
            options.push({ label: name, type: 'namespace', detail: languageByName.get(name) ?? 'script' });
        }
        return { from: context.pos - partial.length, options, validFor: /^[\w./@-]*$/ };
    };
    private readonly hover = async (view: EditorView, pos: number): Promise<Tooltip | null> => {
        const path = this.sync(view.state.doc);
        if (!path)
            return null;
        let info: TS.QuickInfo | null;
        try {
            info = await this.project.quickInfo(path, pos);
        }
        catch {
            return null;
        }
        if (!info || this.disposed)
            return null;
        const dom = infoNode({ signature: displayPartsToString(info.displayParts), doc: this.docText(info.documentation, info.tags), className: 'hx-hover' });
        if (!dom)
            return null;
        return { pos: info.textSpan.start, end: info.textSpan.start + info.textSpan.length, above: true, create: () => ({ dom }) };
    };
    private readonly onUpdate = (update: ViewUpdate): void => {
        if (this.disposed)
            return;
        const open = update.state.field(this.signatureField) !== null;
        if (update.docChanged) {
            const typed = update.transactions.some((transaction) => transaction.isUserEvent('input.type') || transaction.isUserEvent('input.complete'));
            let trigger: TS.SignatureHelpTriggerReason | null = null;
            if (typed) {
                update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
                    const last = inserted.toString().at(-1);
                    if (last === '(' || last === ',' || last === '<')
                        trigger = { kind: 'characterTyped', triggerCharacter: last };
                    else if (last === ')' && open)
                        trigger = { kind: 'retrigger', triggerCharacter: ')' };
                });
            }
            if (trigger || open)
                this.scheduleSignatureHelp(update.view, trigger ?? { kind: 'retrigger' });
        }
        else if (open && update.selectionSet) {
            this.scheduleSignatureHelp(update.view, { kind: 'retrigger' });
        }
    };
    private scheduleSignatureHelp(view: EditorView, reason: TS.SignatureHelpTriggerReason): void {
        if (this.signatureTimer)
            clearTimeout(this.signatureTimer);
        this.signatureTimer = setTimeout(() => {
            this.signatureTimer = null;
            if (!this.disposed)
                void this.updateSignatureHelp(view, reason);
        }, 30);
    }
    private async updateSignatureHelp(view: EditorView, reason: TS.SignatureHelpTriggerReason): Promise<void> {
        const request = ++this.signatureRequest;
        const current = view.state.field(this.signatureField, false) ?? null;
        const close = () => {
            if (view.state.field(this.signatureField, false))
                view.dispatch({ effects: setSignatureHelp.of(null) });
        };
        const path = this.sync(view.state.doc);
        if (!path)
            return close();
        const doc = view.state.doc;
        let items: TS.SignatureHelpItems | null;
        try {
            items = await this.project.signatureHelp(path, view.state.selection.main.head, reason);
        }
        catch {
            return close();
        }
        if (this.disposed || request !== this.signatureRequest)
            return;
        if (!items || items.items.length === 0)
            return close();
        const span = view.state.doc === doc ? items.applicableSpan.start : Math.min(items.applicableSpan.start, view.state.doc.length);
        const sameCall = current !== null && current.pos === span && current.items.items.length === items.items.length;
        const selected = sameCall ? current.selected : items.selectedItemIndex;
        view.dispatch({ effects: setSignatureHelp.of({ pos: span, items, selected: Math.min(selected, items.items.length - 1) }) });
    }
    showSignatureHelp(view: EditorView): boolean {
        void this.updateSignatureHelp(view, { kind: 'invoked' });
        return true;
    }
    private signatureKeys() {
        const cycle = (direction: 1 | -1) => (view: EditorView): boolean => {
            const help = view.state.field(this.signatureField, false);
            if (!help || help.items.items.length < 2 || completionStatus(view.state) === 'active')
                return false;
            const count = help.items.items.length;
            view.dispatch({ effects: setSignatureHelp.of({ ...help, selected: (help.selected + direction + count) % count }) });
            return true;
        };
        return [
            { key: 'ArrowUp', run: cycle(-1) },
            { key: 'ArrowDown', run: cycle(1) },
            {
                key: 'Escape',
                run: (view: EditorView) => {
                    const effects: StateEffect<unknown>[] = [];
                    if (view.state.field(this.signatureField, false))
                        effects.push(setSignatureHelp.of(null));
                    if (view.state.field(transientField, false))
                        effects.push(setTransientTooltip.of(null));
                    if (effects.length === 0)
                        return false;
                    view.dispatch({ effects });
                    return true;
                },
            },
        ];
    }
    async formatDocument(view: EditorView): Promise<boolean> {
        const path = this.sync(view.state.doc);
        if (!path)
            return false;
        const doc = view.state.doc;
        let edits: readonly TS.TextChange[];
        try {
            edits = await this.project.formattingEdits(path, this.formatOptions());
        }
        catch (cause) {
            this.host.session.log.warn(LOG_SOURCE, `Não foi possível formatar: ${cause instanceof Error ? cause.message : String(cause)}`);
            return false;
        }
        if (this.disposed)
            return false;
        if (view.state.doc !== doc) {
            this.host.session.log.warn(LOG_SOURCE, 'O texto mudou durante a formatação; formate de novo.');
            return false;
        }
        const sorted = [...edits].sort((a, b) => a.span.start - b.span.start);
        const changes: ChangeSpec[] = [];
        let last = -1;
        for (const edit of sorted) {
            if (edit.span.start < last)
                continue;
            changes.push({ from: edit.span.start, to: edit.span.start + edit.span.length, insert: edit.newText });
            last = edit.span.start + edit.span.length;
        }
        if (changes.length > 0)
            view.dispatch({ changes, userEvent: 'format', scrollIntoView: true });
        return true;
    }
    async gotoDefinition(view: EditorView): Promise<boolean> {
        const path = this.sync(view.state.doc);
        if (!path)
            return false;
        const pos = view.state.selection.main.head;
        let definition: TS.DefinitionInfo | undefined;
        try {
            definition = (await this.project.definitions(path, pos))[0];
        }
        catch {
            definition = undefined;
        }
        if (this.disposed)
            return false;
        if (!definition) {
            this.transient(view, pos, 'Nenhuma definição encontrada aqui.');
            return false;
        }
        const { textSpan, fileName } = definition;
        if (fileName === path) {
            view.dispatch({ selection: EditorSelection.range(textSpan.start + textSpan.length, textSpan.start), effects: EditorView.scrollIntoView(textSpan.start, { y: 'center' }), userEvent: 'select' });
            view.focus();
            return true;
        }
        const owner = this.project.assetOfPath(fileName);
        const { session } = this.host;
        const asset = owner ? session.library.get(owner.assetId) : null;
        if (asset) {
            const line = lineOf(this.project.textOf(fileName) ?? '', textSpan.start);
            void openScriptAssetInEditor(session, asset, { line, pin: true });
            return true;
        }
        const [text, info] = await Promise.all([this.project.fetchText(fileName).catch(() => null), this.project.quickInfo(path, pos).catch(() => null)]);
        if (this.disposed)
            return false;
        const declaration = text ?? '';
        const line = declaration.split('\n')[lineOf(declaration, textSpan.start) - 1]?.trim() ?? definition.name;
        const where = fileName.startsWith('/helix/') ? 'API da engine (helix.d.ts)' : `biblioteca padrão (${fileName.split('/').pop()})`;
        this.transient(view, pos, `${where}\n\n${this.docText(info?.documentation, info?.tags)}`, line);
        return true;
    }
}
