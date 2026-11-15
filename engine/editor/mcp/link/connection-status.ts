export type ConnectionStatus = {
    readonly state: 'off' | 'connecting';
} | {
    readonly state: 'online';
    readonly toolCount: number;
} | {
    readonly state: 'reconnecting' | 'failed';
    readonly reason: string;
};
