export type InputSelection = {
    readonly kind: 'action';
    readonly actionId: string;
} | {
    readonly kind: 'binding';
    readonly bindingId: string;
    readonly part: string | null;
} | null;
