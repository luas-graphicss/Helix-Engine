import type { Scene } from '@/engine/core/scene/scene';
import { planSceneNetwork, type SceneNetworkPlan } from '../scene/scene-network-plan';
import { SceneSessionDelegate, type SessionGameplay, type SessionObserver } from '../server/scene-session-delegate';
import { createServerConfig, type SessionRules } from '../server/server-config';
import { normalizeMultiplayerSettings, type MultiplayerSettings } from '../settings/multiplayer-settings';
import type { NetworkConditions } from '../transport/network-conditions';
import { LocalSessionLink } from './local-session-link';
export interface SessionBlueprint {
    readonly settings: MultiplayerSettings;
    readonly rules: SessionRules;
    readonly plan: SceneNetworkPlan;
}
export function createSessionBlueprint(scene: Scene, rules: SessionRules): SessionBlueprint {
    return { settings: normalizeMultiplayerSettings(scene.multiplayer), rules, plan: planSceneNetwork(scene) };
}
export function gameplayOf({ settings, plan }: SessionBlueprint): SessionGameplay {
    return { playerTemplates: plan.playerTemplates, transferableKinds: plan.transferableKinds, rpcs: settings.rpcs };
}
export function createLocalLink(blueprint: SessionBlueprint, conditions: NetworkConditions, observer: SessionObserver): LocalSessionLink {
    const { settings, rules, plan } = blueprint;
    const gameplay = gameplayOf(blueprint);
    return new LocalSessionLink(createServerConfig(settings, rules, plan.schema, plan.sceneObjects), conditions, () => new SceneSessionDelegate(gameplay, observer));
}
