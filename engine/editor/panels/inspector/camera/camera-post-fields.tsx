'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { assignPostProcessSettings, findPostProcessPreset, matchPostProcessPreset, POST_PROCESS_PRESETS, TONE_MAPPERS, type PostProcessSettings } from '@/engine/core/environment/post-process-settings';
import { editCameraPost } from '@/engine/editor/operations/camera-operations';
import { TONE_MAPPER_LABELS } from '@/engine/editor/panels/postprocess/color-sections';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
type ToggleableEffect = 'bloom' | 'depthOfField' | 'vignette' | 'chromaticAberration' | 'filmGrain' | 'lensDistortion' | 'sharpen';
const CUSTOM_PRESET = 'custom';
const EXPOSURE_RANGE = { min: -3, max: 3 };
const TONE_MAPPER_OPTIONS = TONE_MAPPERS.map((value) => ({ value, label: TONE_MAPPER_LABELS[value] }));
const EFFECTS: ReadonlyArray<{
    key: ToggleableEffect;
    label: string;
}> = [
    { key: 'bloom', label: 'Bloom' },
    { key: 'depthOfField', label: 'Profundidade de campo' },
    { key: 'vignette', label: 'Vinheta' },
    { key: 'chromaticAberration', label: 'Aberração cromática' },
    { key: 'filmGrain', label: 'Grão de filme' },
    { key: 'lensDistortion', label: 'Distorção de lente' },
    { key: 'sharpen', label: 'Nitidez' },
];
export function CameraPostFields({ entity, post }: {
    entity: Entity;
    post: PostProcessSettings;
}) {
    const session = useEditorSession();
    const preset = matchPostProcessPreset(post) ?? CUSTOM_PRESET;
    const presetOptions = [...POST_PROCESS_PRESETS.map(({ id, name }) => ({ value: id, label: name })), ...(preset === CUSTOM_PRESET ? [{ value: CUSTOM_PRESET, label: 'Personalizado' }] : [])];
    return (<>
      <PropertyRow label="Perfil" hint="Ponto de partida dos efeitos desta câmera">
        <SelectField label="Perfil de pós-processamento" options={presetOptions} value={preset} onChange={(id) => {
            const chosen = findPostProcessPreset(id);
            if (chosen)
                editCameraPost(session, entity, `preset:${id}`, (draft) => assignPostProcessSettings(draft, chosen.create()));
        }}/>
      </PropertyRow>
      <SliderField label="Exposição" value={post.exposure} min={EXPOSURE_RANGE.min} max={EXPOSURE_RANGE.max} step={0.05} suffix=" EV" editable onChange={(exposure) => editCameraPost(session, entity, 'exposure', (draft) => {
            draft.exposure = exposure;
        })}/>
      <PropertyRow label="Tone mapping">
        <SelectField label="Tone mapping" options={TONE_MAPPER_OPTIONS} value={post.toneMapper} onChange={(toneMapper) => editCameraPost(session, entity, 'toneMapper', (draft) => {
            draft.toneMapper = toneMapper;
        })}/>
      </PropertyRow>
      {EFFECTS.map(({ key, label }) => (<ToggleField key={key} label={label} on={post[key].enabled} onToggle={() => editCameraPost(session, entity, `effect:${key}:${post[key].enabled ? 'off' : 'on'}`, (draft) => {
            draft[key].enabled = !draft[key].enabled;
        })}/>))}
    </>);
}
