import type { WindowsBranding } from './pe-branding';
export interface AssembleFile {
    readonly path: string;
    readonly data: ArrayBuffer;
    readonly mode?: number;
    readonly store?: boolean;
}
export interface AssembleRename {
    readonly from: string;
    readonly to: string;
    readonly prefix: boolean;
}
export interface AssembleTextPatch {
    readonly path: string;
    readonly replacements: readonly {
        pattern: string;
        flags?: string;
        replacement: string;
    }[];
}
export interface AssembleLayout {
    readonly os: 'windows' | 'macos' | 'linux';
    readonly root: string;
    readonly drop: readonly string[];
    readonly renames: readonly AssembleRename[];
    readonly executable: string;
    readonly textPatches: readonly AssembleTextPatch[];
}
export interface AssembleJob {
    readonly template: ArrayBuffer;
    readonly files: readonly AssembleFile[];
    readonly layout: AssembleLayout;
    readonly branding: WindowsBranding | null;
    readonly required: readonly string[];
}
export interface AssembleReport {
    readonly entryCount: number;
    readonly totalBytes: number;
    readonly sha256: string;
    readonly executablePath: string;
    readonly branding: 'applied' | 'version-only' | 'skipped' | 'failed';
    readonly brandingError: string | null;
    readonly templateEntriesCopied: number;
    readonly gameFiles: number;
    readonly gameBytes: number;
}
export type AssembleWorkerMessage = {
    readonly type: 'progress';
    readonly fraction: number;
    readonly label: string;
} | {
    readonly type: 'done';
    readonly bytes: ArrayBuffer;
    readonly report: AssembleReport;
} | {
    readonly type: 'error';
    readonly message: string;
};
