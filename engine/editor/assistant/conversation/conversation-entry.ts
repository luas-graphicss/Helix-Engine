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
export interface ReasoningEntry {
    readonly id: number;
    readonly kind: 'reasoning';
    readonly text: string;
    readonly durationMs: number | null;
}
export interface QuestionOption {
    readonly label: string;
    readonly description: string;
}
export interface QuestionAnswer {
    readonly text: string;
    readonly custom: boolean;
}
export type QuestionResolution = {
    readonly status: 'awaiting' | 'cancelled';
} | {
    readonly status: 'answered';
    readonly answer: QuestionAnswer;
};
export interface QuestionEntry {
    readonly id: number;
    readonly kind: 'question';
    readonly question: string;
    readonly options: readonly QuestionOption[];
    readonly resolution: QuestionResolution;
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
export type ConversationEntry = UserEntry | AssistantEntry | ReasoningEntry | QuestionEntry | ToolCallEntry | NoticeEntry;
export const PLAN_STEP_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export type PlanStepStatus = (typeof PLAN_STEP_STATUSES)[number];
export interface PlanStep {
    readonly title: string;
    readonly status: PlanStepStatus;
}
export type AssistantActivity = 'idle' | 'thinking' | 'responding' | 'preparing' | 'working' | 'awaiting';
export interface ConversationSnapshot {
    readonly entries: readonly ConversationEntry[];
    readonly activity: AssistantActivity;
    readonly plan: readonly PlanStep[] | null;
}
