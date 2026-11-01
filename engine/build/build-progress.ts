export type BuildStageId = 'prepare' | 'scripts' | 'pack' | 'runtime' | 'template' | 'assemble' | 'verify' | 'deliver';
export interface BuildStage {
    readonly id: BuildStageId;
    readonly label: string;
    readonly typicalSeconds: number;
}
export const BUILD_STAGES: readonly BuildStage[] = [
    { id: 'prepare', label: 'Salvar e ler o projeto', typicalSeconds: 2 },
    { id: 'scripts', label: 'Pré-compilar os scripts do cliente', typicalSeconds: 6 },
    { id: 'pack', label: 'Empacotar cena, materiais e ativos', typicalSeconds: 5 },
    { id: 'runtime', label: 'Reunir o runtime do jogo (sem o editor)', typicalSeconds: 8 },
    { id: 'template', label: 'Obter o Helix Player para a plataforma', typicalSeconds: 40 },
    { id: 'assemble', label: 'Montar o executável', typicalSeconds: 12 },
    { id: 'verify', label: 'Verificar o pacote final', typicalSeconds: 3 },
    { id: 'deliver', label: 'Entregar o arquivo', typicalSeconds: 1 },
];
export type BuildLogLevel = 'info' | 'warn' | 'error';
export interface BuildLogLine {
    readonly at: number;
    readonly level: BuildLogLevel;
    readonly message: string;
}
export type BuildStatus = 'idle' | 'running' | 'done' | 'failed' | 'cancelled';
export interface BuildProgressSnapshot {
    readonly status: BuildStatus;
    readonly stage: BuildStageId | null;
    readonly stageFraction: number;
    readonly totalFraction: number;
    readonly etaSeconds: number | null;
    readonly detail: string | null;
    readonly startedAt: number | null;
    readonly finishedAt: number | null;
    readonly log: readonly BuildLogLine[];
    readonly completed: ReadonlySet<BuildStageId>;
}
const DURATIONS_KEY = 'helix-build:stage-durations';
function loadMeasuredDurations(): Partial<Record<BuildStageId, number>> {
    if (typeof localStorage === 'undefined')
        return {};
    try {
        const parsed = JSON.parse(localStorage.getItem(DURATIONS_KEY) ?? '{}') as unknown;
        return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<BuildStageId, number>>) : {};
    }
    catch {
        return {};
    }
}
export function saveMeasuredDurations(durations: Partial<Record<BuildStageId, number>>): void {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(DURATIONS_KEY, JSON.stringify({ ...loadMeasuredDurations(), ...durations }));
    }
    catch {
    }
}
export function predictStageSeconds(skipped: ReadonlySet<BuildStageId> = new Set()): Record<BuildStageId, number> {
    const measured = loadMeasuredDurations();
    const result = {} as Record<BuildStageId, number>;
    for (const stage of BUILD_STAGES) {
        const known = measured[stage.id];
        result[stage.id] = skipped.has(stage.id) ? 0 : known !== undefined && known > 0 ? known : stage.typicalSeconds;
    }
    return result;
}
export interface EtaInput {
    readonly predicted: Record<BuildStageId, number>;
    readonly current: BuildStageId | null;
    readonly currentFraction: number;
    readonly currentElapsedSeconds: number;
    readonly completed: ReadonlySet<BuildStageId>;
}
export function estimateProgress({ predicted, current, currentFraction, currentElapsedSeconds, completed }: EtaInput): {
    totalFraction: number;
    etaSeconds: number | null;
} {
    let total = 0;
    let done = 0;
    let remaining = 0;
    let reached = false;
    for (const stage of BUILD_STAGES) {
        const seconds = predicted[stage.id];
        total += seconds;
        if (completed.has(stage.id)) {
            done += seconds;
            continue;
        }
        if (stage.id === current) {
            reached = true;
            const fraction = Math.min(Math.max(currentFraction, 0), 1);
            done += seconds * fraction;
            const byPrediction = Math.max(seconds - currentElapsedSeconds, 0);
            const byPace = fraction > 0.02 ? currentElapsedSeconds * (1 - fraction) / fraction : byPrediction;
            remaining += fraction >= 1 ? 0 : Math.max(byPrediction * (1 - fraction), Math.min(byPace, byPrediction * 4 + 5));
            continue;
        }
        if (reached || current === null)
            remaining += seconds;
    }
    return { totalFraction: total > 0 ? Math.min(done / total, 1) : 0, etaSeconds: current === null ? null : Math.round(remaining) };
}
export function formatEta(seconds: number | null): string {
    if (seconds === null)
        return 'calculando…';
    if (seconds < 5)
        return 'alguns segundos';
    if (seconds < 60)
        return `~${Math.ceil(seconds / 5) * 5} s`;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round((seconds % 60) / 10) * 10;
    return rest > 0 && minutes < 10 ? `~${minutes} min ${rest} s` : `~${minutes} min`;
}
export function formatBuildBytes(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
