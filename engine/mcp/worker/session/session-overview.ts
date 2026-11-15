import type { FileUsage } from './file-store';
import type { SessionStats } from './session-stats';
export interface SessionOverview {
    readonly engineOnline: boolean;
    readonly project: string | null;
    readonly engineVersion: string | null;
    readonly accessMode: string | null;
    readonly toolCount: number;
    readonly secondsSinceContact: number | null;
    readonly queue: {
        readonly waiting: number;
        readonly running: number;
        readonly limit: number;
    };
    readonly calls: SessionStats;
    readonly files: FileUsage;
    readonly worker: {
        readonly version: string;
        readonly bridgeProtocol: number;
    };
}
