export interface NetworkConditions {
    readonly latencyMs: number;
    readonly jitterMs: number;
    readonly lossRate: number;
    readonly duplicateRate: number;
    readonly reorderRate: number;
}
export interface NetworkPreset {
    readonly id: string;
    readonly label: string;
    readonly conditions: NetworkConditions;
}
export const PERFECT_CONDITIONS: NetworkConditions = { latencyMs: 0, jitterMs: 0, lossRate: 0, duplicateRate: 0, reorderRate: 0 };
export const MAX_SIMULATED_LATENCY_MS = 2000;
export const NETWORK_PRESETS: readonly NetworkPreset[] = [
    { id: 'perfect', label: 'Sem degradação', conditions: PERFECT_CONDITIONS },
    { id: 'lan', label: 'Rede local', conditions: { latencyMs: 2, jitterMs: 1, lossRate: 0, duplicateRate: 0, reorderRate: 0 } },
    { id: 'broadband', label: 'Banda larga', conditions: { latencyMs: 20, jitterMs: 4, lossRate: 0.001, duplicateRate: 0, reorderRate: 0.001 } },
    { id: 'wifi', label: 'Wi-Fi doméstico', conditions: { latencyMs: 35, jitterMs: 12, lossRate: 0.01, duplicateRate: 0.001, reorderRate: 0.01 } },
    { id: 'mobile-4g', label: '4G', conditions: { latencyMs: 60, jitterMs: 25, lossRate: 0.02, duplicateRate: 0.002, reorderRate: 0.02 } },
    { id: 'mobile-3g', label: '3G', conditions: { latencyMs: 150, jitterMs: 60, lossRate: 0.04, duplicateRate: 0.005, reorderRate: 0.04 } },
    { id: 'satellite', label: 'Satélite', conditions: { latencyMs: 320, jitterMs: 40, lossRate: 0.02, duplicateRate: 0, reorderRate: 0.01 } },
    { id: 'unstable', label: 'Conexão instável', conditions: { latencyMs: 120, jitterMs: 120, lossRate: 0.12, duplicateRate: 0.02, reorderRate: 0.1 } },
];
const REORDER_BASE_MS = 20;
const PERCENT = 100;
const PERCENT_DECIMALS = 3;
const RATE_DECIMALS = 5;
export function rateToPercent(rate: number): number {
    return Number((rate * PERCENT).toFixed(PERCENT_DECIMALS));
}
export function percentToRate(percent: number): number {
    return Number((percent / PERCENT).toFixed(RATE_DECIMALS));
}
function clampRate(rate: number): number {
    return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0;
}
function clampDelay(delayMs: number): number {
    return Number.isFinite(delayMs) ? Math.min(MAX_SIMULATED_LATENCY_MS, Math.max(0, delayMs)) : 0;
}
export function normalizeNetworkConditions(conditions: Partial<NetworkConditions>): NetworkConditions {
    return {
        latencyMs: clampDelay(conditions.latencyMs ?? 0),
        jitterMs: clampDelay(conditions.jitterMs ?? 0),
        lossRate: clampRate(conditions.lossRate ?? 0),
        duplicateRate: clampRate(conditions.duplicateRate ?? 0),
        reorderRate: clampRate(conditions.reorderRate ?? 0),
    };
}
export function isDegraded(conditions: NetworkConditions): boolean {
    return conditions.latencyMs > 0 || conditions.jitterMs > 0 || conditions.lossRate > 0 || conditions.duplicateRate > 0 || conditions.reorderRate > 0;
}
export function matchingPreset(conditions: NetworkConditions): NetworkPreset | null {
    return (NETWORK_PRESETS.find(({ conditions: preset }) => preset.latencyMs === conditions.latencyMs && preset.jitterMs === conditions.jitterMs && preset.lossRate === conditions.lossRate && preset.duplicateRate === conditions.duplicateRate && preset.reorderRate === conditions.reorderRate) ?? null);
}
function deliveryDelay(conditions: NetworkConditions, random: () => number): number {
    const jitter = conditions.jitterMs > 0 ? (random() * 2 - 1) * conditions.jitterMs : 0;
    const overtaken = conditions.reorderRate > 0 && random() < conditions.reorderRate;
    const detour = overtaken ? random() * (conditions.latencyMs + 2 * conditions.jitterMs + REORDER_BASE_MS) : 0;
    return Math.max(0, conditions.latencyMs + jitter + detour);
}
export function planDeliveries(conditions: NetworkConditions, random: () => number): number[] {
    if (conditions.lossRate > 0 && random() < conditions.lossRate)
        return [];
    const delays = [deliveryDelay(conditions, random)];
    if (conditions.duplicateRate > 0 && random() < conditions.duplicateRate)
        delays.push(deliveryDelay(conditions, random));
    return delays;
}
