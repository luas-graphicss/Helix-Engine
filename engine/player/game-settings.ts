import { engineSettings } from '@/engine/settings/engine-settings-store';
import { SETTING_IDS, type SettingId } from '@/engine/settings/engine-settings-schema';
import type { GameManifest } from './game-manifest';
export const GAME_SETTING_IDS: readonly SettingId[] = SETTING_IDS.filter((id) => (id.startsWith('render.') && !id.startsWith('render.helpers.') && id !== 'render.editorLite' && id !== 'render.csgGhosts') ||
    id.startsWith('simulation.physics.') ||
    id === 'simulation.pauseOnBlur' ||
    id.startsWith('editor.camera.') ||
    id === 'editor.open.shadows' ||
    id.startsWith('audio.'));
export function snapshotGameSettings(): Record<string, boolean | number | string> {
    return engineSettings.snapshot(GAME_SETTING_IDS);
}
export function adoptGameSettings(manifest: GameManifest): void {
    engineSettings.adopt({
        ...manifest.settings,
        'render.helpers.lights': 'off',
        'render.helpers.sounds': 'off',
        'render.helpers.vfx': 'off',
        'render.editorLite': false,
        'render.csgGhosts': false,
        'simulation.timeScale': 1,
        'simulation.net.server': manifest.net.authoritative ? 'hosted' : 'simulated',
    });
}
