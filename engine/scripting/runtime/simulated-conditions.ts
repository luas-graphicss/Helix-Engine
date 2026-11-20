import { normalizeNetworkConditions, percentToRate, rateToPercent, type NetworkConditions } from '@/engine/net/transport/network-conditions';
import { engineSettings } from '@/engine/settings/engine-settings-store';
export interface ConditionsTarget {
    setConditions(conditions: NetworkConditions): boolean;
}
export function readSimulatedConditions(): NetworkConditions {
    return normalizeNetworkConditions({
        latencyMs: engineSettings.get('simulation.net.latency'),
        jitterMs: engineSettings.get('simulation.net.jitter'),
        lossRate: percentToRate(engineSettings.get('simulation.net.loss')),
        duplicateRate: percentToRate(engineSettings.get('simulation.net.duplicate')),
        reorderRate: percentToRate(engineSettings.get('simulation.net.reorder')),
    });
}
export function applySimulatedConditions(target: ConditionsTarget, patch: Partial<NetworkConditions>): NetworkConditions {
    const next = normalizeNetworkConditions({ ...readSimulatedConditions(), ...patch });
    engineSettings.set('simulation.net.latency', next.latencyMs);
    engineSettings.set('simulation.net.jitter', next.jitterMs);
    engineSettings.set('simulation.net.loss', rateToPercent(next.lossRate));
    engineSettings.set('simulation.net.duplicate', rateToPercent(next.duplicateRate));
    engineSettings.set('simulation.net.reorder', rateToPercent(next.reorderRate));
    const stored = readSimulatedConditions();
    target.setConditions(stored);
    return stored;
}
