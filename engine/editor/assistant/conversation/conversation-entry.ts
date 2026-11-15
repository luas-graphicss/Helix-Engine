export type ToolCallStatus = 'awaiting' | 'running' | 'done' | 'failed' | 'denied' | 'blocked';
export type NoticeTone = 'info' | 'error';
export interface UserEntry {
    readonly id: number;
    readonly kind: 'user';
    readonly text: string;
}
export interface AssistantEntry {
    readonly id: number;
    readonly kind: 'assistant';
    readonly text: string;
}
export interface ToolCallEntry {
    readonly id: number;
    readonly kind: 'tool';
    readonly title: string;
    readonly summary: string;
    readonly input: string;
    readonly status: ToolCallStatus;
    readonly output: string;
}
export interface NoticeEntry {
    readonly id: number;
    readonly kind: 'notice';
    readonly tone: NoticeTone;
    readonly text: string;
}
export type ConversationEntry = UserEntry | AssistantEntry | ToolCallEntry | NoticeEntry;
export type AssistantActivity = 'idle' | 'thinking' | 'working' | 'awaiting';
export interface ConversationSnapshot {
    readonly entries: readonly ConversationEntry[];
    readonly activity: AssistantActivity;
}
