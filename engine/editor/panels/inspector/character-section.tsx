'use client';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import type { Entity } from '@/engine/core/scene/entity';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { setCharacterAutoPossess, setCharacterModel, setCharacterScalar, type CharacterScalar } from '@/engine/editor/operations/character-operations';
import { hasModel } from '@/engine/character/rig/character-rig';
import type { AnimatorState } from '@/engine/character/animation/locomotion-animator';
import { CharacterModelSelect, useCharacterModels } from '../character/character-model-select';
import { AnimationSection } from '../character/animation-section';
import { ScalarField } from './number-fields';
const ANIMATOR_STATE_LABEL: Record<AnimatorState, string> = {
    stand: 'Locomoção em pé',
    crouch: 'Locomoção agachado',
    jump: 'Pulo',
    fall: 'Queda',
    land: 'Aterrissagem',
};
type ScalarRow = {
    field: CharacterScalar;
    label: string;
    suffix: string;
};
const CAPSULE_ROWS: readonly ScalarRow[] = [
    { field: 'radius', label: 'Raio', suffix: ' m' },
    { field: 'height', label: 'Altura', suffix: ' m' },
    { field: 'crouchHeight', label: 'Alt. agachado', suffix: ' m' },
    { field: 'mass', label: 'Massa', suffix: ' kg' },
];
const LOCOMOTION_ROWS: readonly ScalarRow[] = [
    { field: 'walkSpeed', label: 'Andar', suffix: ' m/s' },
    { field: 'runSpeed', label: 'Correr', suffix: ' m/s' },
    { field: 'crouchSpeed', label: 'Agachado', suffix: ' m/s' },
    { field: 'acceleration', label: 'Aceleração', suffix: ' m/s²' },
    { field: 'braking', label: 'Frenagem', suffix: ' m/s²' },
    { field: 'jumpHeight', label: 'Pulo', suffix: ' m' },
    { field: 'stepHeight', label: 'Degrau', suffix: ' m' },
    { field: 'maxSlopeDegrees', label: 'Inclinação máx.', suffix: '°' },
    { field: 'rotationRate', label: 'Giro', suffix: ' °/s' },
];
function ScalarRows({ entity, rows }: {
    entity: Entity;
    rows: readonly ScalarRow[];
}) {
    const session = useEditorState();
    const settings = entity.character;
    if (!settings)
        return null;
    return (<>
      {rows.map(({ field, label, suffix }) => (<PropertyRow key={field} label={label}>
          <ScalarField label={label} value={settings[field]} suffix={suffix} onCommit={(value) => setCharacterScalar(session, entity, field, value)}/>
        </PropertyRow>))}
    </>);
}
export function CharacterRuntimeReadout({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const instance = session.playtest.characters?.instanceOf(entity) ?? null;
    if (!instance)
        return null;
    const { controller, animator } = instance;
    const state = !controller.grounded ? 'No ar' : controller.crouching ? 'Agachado' : controller.horizontalSpeed > 0.05 ? 'Em movimento' : 'Parado';
    const possessed = session.playtest.characters?.possessed === instance;
    return (<>
      <PropertyRow label="Estado">
        <FieldInput readOnly value={possessed ? `${state} · possuído` : state} aria-label="Estado do personagem"/>
      </PropertyRow>
      <PropertyRow label="Velocidade">
        <FieldInput readOnly value={`${controller.horizontalSpeed.toFixed(2)} m/s`} aria-label="Velocidade horizontal"/>
      </PropertyRow>
      <PropertyRow label="Animação">
        <FieldInput readOnly value={animator ? ANIMATOR_STATE_LABEL[animator.state] : 'Sem animador'} aria-label="Estado da animação"/>
      </PropertyRow>
    </>);
}
export function CharacterSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const models = useCharacterModels();
    const settings = entity.character;
    if (!settings)
        return null;
    const sharesProfile = settings === session.scene.player.character;
    const modelReady = hasModel(entity);
    const modelKnown = models.some((model) => model.id === settings.model);
    return (<>
      <CollapsibleSection title="Personagem">
        <ToggleField label="Auto-possuir" on={settings.autoPossess} onToggle={() => setCharacterAutoPossess(session, entity, !settings.autoPossess)}/>
        <PropertyRow label="Modelo">
          <CharacterModelSelect value={settings.model} onChange={(id) => setCharacterModel(session, entity, id)}/>
        </PropertyRow>
        {!modelReady && <Hint>Carregando o modelo…</Hint>}
        {modelReady && !modelKnown && <Hint>Modelo não carregado nesta sessão; o ator veste o manequim. Reimporte-o na aba Personagem.</Hint>}
        {sharesProfile && <Hint>Este é o personagem do jogador desta simulação: edita o perfil da aba Personagem.</Hint>}
        <ScalarRows entity={entity} rows={CAPSULE_ROWS}/>
        <CharacterRuntimeReadout entity={entity}/>
      </CollapsibleSection>

      <CollapsibleSection title="Locomoção">
        <ScalarRows entity={entity} rows={LOCOMOTION_ROWS}/>
        <SliderField label="Controle aéreo" value={settings.airControl} min={0} max={1} onChange={(value) => setCharacterScalar(session, entity, 'airControl', value)}/>
      </CollapsibleSection>

      <AnimationSection entity={entity}/>
    </>);
}
function Hint({ children }: {
    children: string;
}) {
    return <p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
