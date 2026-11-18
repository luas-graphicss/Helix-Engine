import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { summarizeEntity } from '@/engine/editor/assistant/tools/entity-summary';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { addSoundSource, attachAudioSource, canCarryAudio, setAudioSourceAsset } from '@/engine/editor/operations/audio-world-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
export interface AudioPlacement {
    readonly name: string;
    readonly entity: Entity | null;
    readonly position: Vec3 | null;
    readonly addToScene: boolean;
}
export function placeAudio(session: EditorSession, asset: LibraryAsset, placement: AudioPlacement): object {
    const { entity } = placement;
    if (entity) {
        if (!canCarryAudio(entity))
            throw new ToolFailure(`"${entity.name}" cannot carry a sound source. Pick a regular actor, not the scene root, a terrain or a CSG brush.`);
        if (entity.audioSource)
            setAudioSourceAsset(session, entity, asset.id);
        else
            attachAudioSource(session, entity, asset.id);
        return { soundSource: summarizeEntity(entity) };
    }
    if (!placement.addToScene)
        return {};
    return { soundSource: summarizeEntity(addSoundSource(session, { assetId: asset.id, position: placement.position ?? undefined, name: placement.name })) };
}
