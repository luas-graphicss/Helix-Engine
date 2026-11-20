import type { SessionBlueprint } from '../runtime/session-blueprint';
import type { NetworkTemplate, SceneNetworkPlan } from '../scene/scene-network-plan';
import type { SceneObjectSeed, SessionRules } from '../server/server-config';
import { createMultiplayerSettings, normalizeMultiplayerSettings, type MultiplayerSettings } from '../settings/multiplayer-settings';
export type ManifestPlan = Pick<SceneNetworkPlan, 'sceneObjects' | 'playerTemplates' | 'transferableKinds' | 'schema'>;
export interface MultiplayerManifest {
    readonly settings: MultiplayerSettings;
    readonly rules: SessionRules;
    readonly plan: ManifestPlan;
}
const MANIFEST_PATH = 'game/manifest.json';
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isTemplate(value: unknown): value is NetworkTemplate {
    return isRecord(value) && typeof value.kind === 'string';
}
function isSceneObject(value: unknown): value is SceneObjectSeed {
    return isTemplate(value) && 'sceneId' in value && typeof value.sceneId === 'number' && Number.isInteger(value.sceneId) && value.sceneId > 0;
}
function malformed(field: string): Error {
    return new Error(`${MANIFEST_PATH}: o campo multiplayer.${field} está ausente ou malformado; exporte o pacote de servidor de novo pelo editor.`);
}
function positiveInteger(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
        throw malformed(field);
    return value;
}
export function createMultiplayerManifest({ settings, rules, plan }: SessionBlueprint): MultiplayerManifest {
    return { settings, rules, plan: { sceneObjects: plan.sceneObjects, playerTemplates: plan.playerTemplates, transferableKinds: plan.transferableKinds, schema: plan.schema } };
}
export function readMultiplayerManifest(value: unknown): MultiplayerManifest {
    if (!isRecord(value) || !isRecord(value.settings) || !isRecord(value.rules) || !isRecord(value.plan))
        throw malformed('settings');
    const { plan, rules } = value;
    if (typeof plan.schema !== 'string' || !plan.schema)
        throw malformed('plan.schema');
    if (!Array.isArray(plan.sceneObjects) || !plan.sceneObjects.every(isSceneObject))
        throw malformed('plan.sceneObjects');
    if (!Array.isArray(plan.playerTemplates) || !plan.playerTemplates.every(isTemplate))
        throw malformed('plan.playerTemplates');
    if (!Array.isArray(plan.transferableKinds) || !plan.transferableKinds.every((kind) => typeof kind === 'string'))
        throw malformed('plan.transferableKinds');
    return {
        settings: normalizeMultiplayerSettings({ ...createMultiplayerSettings(), ...value.settings }),
        rules: { tickRate: positiveInteger(rules.tickRate, 'rules.tickRate'), maxPlayers: positiveInteger(rules.maxPlayers, 'rules.maxPlayers') },
        plan: { sceneObjects: plan.sceneObjects, playerTemplates: plan.playerTemplates, transferableKinds: plan.transferableKinds, schema: plan.schema },
    };
}
