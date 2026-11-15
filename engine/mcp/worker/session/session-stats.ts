export interface SessionStats {
    submitted: number;
    completed: number;
    failed: number;
    expired: number;
    refused: number;
}
export function createSessionStats(): SessionStats {
    return { submitted: 0, completed: 0, failed: 0, expired: 0, refused: 0 };
}
