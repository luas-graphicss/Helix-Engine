import type { CompletionSource } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
export interface LanguageIntelligence {
    readonly completionSources: readonly CompletionSource[] | null;
    readonly extensions: Extension;
    formatDocument?(view: EditorView): Promise<boolean>;
    renameSymbol?(view: EditorView): Promise<boolean>;
    gotoDefinition?(view: EditorView): Promise<boolean>;
    showSignatureHelp?(view: EditorView): boolean;
    dispose(): void;
}
export const NO_INTELLIGENCE: LanguageIntelligence = { completionSources: null, extensions: [], dispose: () => undefined };
