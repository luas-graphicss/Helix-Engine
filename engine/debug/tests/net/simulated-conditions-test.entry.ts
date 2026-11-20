import { NETWORK_PRESETS, PERFECT_CONDITIONS, matchingPreset, percentToRate, type NetworkConditions } from '@/engine/net/transport/network-conditions';
import { applySimulatedConditions, readSimulatedConditions, type ConditionsTarget } from '@/engine/scripting/runtime/simulated-conditions';
import { ENGINE_SETTINGS } from '@/engine/settings/engine-settings-schema';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Ferramentas: rede simulada guardada nas preferências');
const EXTRA_APPLICATIONS = 3;
const applied: NetworkConditions[] = [];
const target: ConditionsTarget = {
    setConditions: (conditions) => {
        applied.push(conditions);
        return true;
    },
};
function sameConditions(a: NetworkConditions | undefined, b: NetworkConditions): boolean {
    return a !== undefined && a.latencyMs === b.latencyMs && a.jitterMs === b.jitterMs && a.lossRate === b.lossRate && a.duplicateRate === b.duplicateRate && a.reorderRate === b.reorderRate;
}
engineSettings.adopt({});
checks.check('sem preferência gravada a ligação é perfeita', sameConditions(readSimulatedConditions(), PERFECT_CONDITIONS));
for (const preset of NETWORK_PRESETS) {
    const stored = applySimulatedConditions(target, preset.conditions);
    checks.check(`o perfil ${preset.label} volta igual das preferências`, sameConditions(stored, preset.conditions) && matchingPreset(readSimulatedConditions())?.id === preset.id, JSON.stringify(stored));
    checks.check(`o perfil ${preset.label} chega à sessão em andamento`, sameConditions(applied.at(-1), preset.conditions));
}
const wifi = NETWORK_PRESETS.find((preset) => preset.id === 'wifi')?.conditions ?? PERFECT_CONDITIONS;
checks.check('existe um perfil de Wi-Fi com perda e pacotes fora de ordem', wifi.lossRate > 0 && wifi.reorderRate > 0);
applySimulatedConditions(target, wifi);
const edited = applySimulatedConditions(target, { latencyMs: 80 });
checks.check('mudar só a latência guarda os outros valores', edited.latencyMs === 80 && edited.jitterMs === wifi.jitterMs && edited.lossRate === wifi.lossRate && edited.duplicateRate === wifi.duplicateRate && edited.reorderRate === wifi.reorderRate, JSON.stringify(edited));
checks.check('valores fora dos perfis contam como personalizados', matchingPreset(edited) === null);
const clamped = applySimulatedConditions(target, { latencyMs: 99999, jitterMs: -40, lossRate: 3, duplicateRate: Number.NaN, reorderRate: 0.75 });
const expected: NetworkConditions = {
    latencyMs: ENGINE_SETTINGS['simulation.net.latency'].max,
    jitterMs: 0,
    lossRate: percentToRate(ENGINE_SETTINGS['simulation.net.loss'].max),
    duplicateRate: 0,
    reorderRate: percentToRate(ENGINE_SETTINGS['simulation.net.reorder'].max),
};
checks.check('valores fora da faixa param nos limites das preferências', sameConditions(clamped, expected), JSON.stringify(clamped));
checks.check('a sessão recebe o que ficou guardado, não o que foi pedido', sameConditions(applied.at(-1), expected));
checks.check('cada mudança é aplicada uma vez', applied.length === NETWORK_PRESETS.length + EXTRA_APPLICATIONS, String(applied.length));
checks.finish();
