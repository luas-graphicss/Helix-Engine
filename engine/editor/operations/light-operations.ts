import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
export type LightColorField = 'color' | 'skyColor' | 'groundColor';
export function setLightIntensity(session: EditorSession, entity: Entity, value: number): void {
    const { light } = entity;
    if (!light || !Number.isFinite(value))
        return;
    const next = Math.max(0, value);
    if (light.intensity === next)
        return;
    session.history.execute(new SetValueCommand('Intensidade da luz', (v) => {
        light.intensity = v;
    }, light.intensity, next, `light:${entity.id}:intensity`));
}
export function setLightColor(session: EditorSession, entity: Entity, field: LightColorField, linearRgb: Vec3): void {
    const { light } = entity;
    if (!light)
        return;
    const target = field === 'color' ? (light.type === 'directional' ? light.color : null) : light.type === 'ambient' ? light[field] : null;
    if (!target)
        return;
    session.history.execute(new SetValueCommand('Cor da luz', (value) => vec3.copy(target, value), vec3.copy(vec3.create(), target), vec3.copy(vec3.create(), linearRgb), `light:${entity.id}:${field}`));
}
export function setLightShadows(session: EditorSession, entity: Entity, enabled: boolean): void {
    const { light } = entity;
    if (light?.type !== 'directional' || light.castShadows === enabled)
        return;
    session.history.execute(new SetValueCommand(enabled ? 'Ativar sombras da luz' : 'Desativar sombras da luz', (value) => {
        light.castShadows = value;
    }, light.castShadows, enabled));
}
