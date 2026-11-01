import type { CodeCommandId } from './code-commands';
export interface CodeViewHandle {
    readonly assetId: string;
    focus(): void;
    selectedText(): string;
    gotoLine(line: number, column?: number): void;
    lineCount(): number;
    findNext(): boolean;
    findPrevious(): boolean;
    replaceNext(): boolean;
    replaceAll(): boolean;
    selectAllMatches(): boolean;
    run(command: CodeCommandId): boolean;
    canRun(command: CodeCommandId): boolean;
}
