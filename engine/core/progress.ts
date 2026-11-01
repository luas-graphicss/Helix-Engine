export interface Progress {
    label: string;
    fraction: number;
}
export type ProgressReporter = (progress: Progress) => void;
