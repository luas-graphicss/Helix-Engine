import type { Entity } from '@/engine/core/scene/entity';
import { isLocalLight } from '@/engine/core/scene/light';
import { setLightColor, setLightIntensity, setLightShadows, setLocalLightScalar } from '@/engine/editor/operations/light-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { HEX_COLOR_HINT, optionalLinearColor } from './color-input';
import { ToolFailure } from './tool-failure';
import type { ToolInput } from './tool-input';
import { flag, number, text } from './tool-parameters';
export const LIGHT_SETTING_PARAMETERS = {
    intensity: number('Light intensity.'),
    color: text(`Light color. ${HEX_COLOR_HINT}`),
    range: number('Reach in meters. Only for point, spot, rect, disc and tube lights.'),
    castShadows: flag('Whether the light casts shadows.'),
};
export function applyLightSettings(session: EditorSession, entity: Entity, input: ToolInput): void {
    const { light } = entity;
    if (!light)
        throw new ToolFailure(`${entity.name} is not a light.`);
    const intensity = input.optionalNumber('intensity');
    if (intensity !== undefined)
        setLightIntensity(session, entity, intensity);
    const color = optionalLinearColor(input, 'color');
    if (color)
        setLightColor(session, entity, light.type === 'ambient' ? 'skyColor' : 'color', color);
    const range = input.optionalNumber('range');
    if (range !== undefined) {
        if (!isLocalLight(light))
            throw new ToolFailure('Only point, spot, rect, disc and tube lights have a range.');
        setLocalLightScalar(session, entity, 'range', range);
    }
    const castShadows = input.optionalFlag('castShadows');
    if (castShadows !== undefined)
        setLightShadows(session, entity, castShadows);
}
