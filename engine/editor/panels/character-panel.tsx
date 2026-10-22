'use client';
import { PersonStanding, Plus, RotateCcw, Copy } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField, ToggleSwitch } from '@/engine/ui/toggle-field';
import { IconButton } from '@/engine/ui/icon-button';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { addCharacter, type CharacterScalar } from '@/engine/editor/operations/character-operations';
import { applyPlayerProfileToActors, hasPossessableActor, independentCharacterActors, resetPlayerSettings, setPlayerCameraInvertY, setPlayerCameraScalar, setPlayerCharacterScalar, setPlayerEnabled, setPlayerSpawnIfMissing, type PlayerCameraScalar, } from '@/engine/editor/operations/player-operations';
import { ModelSection } from './character/model-section';
import { AnimationSection } from './character/animation-section';
import { useCharacterModels } from './character/character-model-select';
import { CharacterRuntimeReadout } from './inspector/character-section';
import { Hint, SubHeading } from './character/panel-text';
const meters = (value: number) => `${Number(value.toFixed(2))} m`;
const metersPerSecond = (value: number) => `${Number(value.toFixed(1))} m/s`;
const metersPerSecondSquared = (value: number) => `${Math.round(value)} m/s²`;
const degrees = (value: number) => `${Math.round(value)}°`;
const degreesPerSecond = (value: number) => `${Math.round(value)} °/s`;
const degreesPerPixel = (value: number) => `${Number(value.toFixed(2))} °/px`;
const kilograms = (value: number) => `${Math.round(value)} kg`;
const percent = (value: number) => `${Math.round(value * 100)}%`;
interface CharacterSlider {
    field: CharacterScalar;
    label: string;
    min: number;
    max: number;
    step?: number;
    format: (value: number) => string;
}
const CAPSULE_SLIDERS: readonly CharacterSlider[] = [
    { field: 'height', label: 'Altura', min: 0.5, max: 3, step: 0.01, format: meters },
    { field: 'radius', label: 'Raio', min: 0.1, max: 1, step: 0.01, format: meters },
    { field: 'crouchHeight', label: 'Alt. agachado', min: 0.4, max: 3, step: 0.01, format: meters },
    { field: 'mass', label: 'Massa', min: 20, max: 200, step: 1, format: kilograms },
];
const SPEED_SLIDERS: readonly CharacterSlider[] = [
    { field: 'walkSpeed', label: 'Andar', min: 0, max: 10, step: 0.1, format: metersPerSecond },
    { field: 'runSpeed', label: 'Correr', min: 0, max: 15, step: 0.1, format: metersPerSecond },
    { field: 'crouchSpeed', label: 'Agachado', min: 0, max: 5, step: 0.1, format: metersPerSecond },
    { field: 'acceleration', label: 'Aceleração', min: 1, max: 60, step: 1, format: metersPerSecondSquared },
    { field: 'braking', label: 'Frenagem', min: 1, max: 60, step: 1, format: metersPerSecondSquared },
    { field: 'rotationRate', label: 'Giro', min: 30, max: 1440, step: 10, format: degreesPerSecond },
];
const JUMP_SLIDERS: readonly CharacterSlider[] = [
    { field: 'jumpHeight', label: 'Altura do pulo', min: 0, max: 5, step: 0.05, format: meters },
    { field: 'airControl', label: 'Controle aéreo', min: 0, max: 1, step: 0.01, format: percent },
    { field: 'stepHeight', label: 'Degrau', min: 0, max: 1, step: 0.01, format: meters },
    { field: 'maxSlopeDegrees', label: 'Inclinação máx.', min: 0, max: 89, step: 1, format: degrees },
];
interface CameraSlider {
    field: PlayerCameraScalar;
    label: string;
    min: number;
    max: number;
    step?: number;
    format: (value: number) => string;
}
const CAMERA_DISTANCE_SLIDERS: readonly CameraSlider[] = [
    { field: 'distance', label: 'Inicial', min: 0.5, max: 15, step: 0.1, format: meters },
    { field: 'minDistance', label: 'Mínima', min: 0.5, max: 15, step: 0.1, format: meters },
    { field: 'maxDistance', label: 'Máxima', min: 0.5, max: 30, step: 0.1, format: meters },
];
const CAMERA_PITCH_SLIDERS: readonly CameraSlider[] = [
    { field: 'pitch', label: 'Inicial', min: -89, max: 89, step: 1, format: degrees },
    { field: 'minPitch', label: 'Mínima', min: -89, max: 89, step: 1, format: degrees },
    { field: 'maxPitch', label: 'Máxima', min: -89, max: 89, step: 1, format: degrees },
];
function CharacterSliders({ sliders, disabled }: {
    sliders: readonly CharacterSlider[];
    disabled: boolean;
}) {
    const session = useEditorState();
    const { character } = session.scene.player;
    return (<>
      {sliders.map(({ field, label, min, max, step, format }) => (<SliderField key={field} label={label} value={character[field]} min={min} max={max} step={step} format={format} disabled={disabled} onChange={(value) => setPlayerCharacterScalar(session, field, value)}/>))}
    </>);
}
function CameraSliders({ sliders, disabled }: {
    sliders: readonly CameraSlider[];
    disabled: boolean;
}) {
    const session = useEditorState();
    const { camera } = session.scene.player;
    return (<>
      {sliders.map(({ field, label, min, max, step, format }) => (<SliderField key={field} label={label} value={camera[field]} min={min} max={max} step={step} format={format} disabled={disabled} onChange={(value) => setPlayerCameraScalar(session, field, value)}/>))}
    </>);
}
function SceneSection({ disabled }: {
    disabled: boolean;
}) {
    const session = useEditorState();
    const { scene } = session;
    const { player } = scene;
    const actors = independentCharacterActors(scene);
    const possessable = hasPossessableActor(scene);
    const running = session.playtest.isRunning;
    return (<CollapsibleSection title="Na cena">
      <ToggleField label="Criar no início se faltar" on={player.spawnIfMissing} onToggle={() => setPlayerSpawnIfMissing(session, !player.spawnIfMissing)}/>
      <Hint>
        {possessable
            ? 'Há um ator com auto-posse na cena: a simulação possui esse ator e não cria o personagem padrão. As configurações dele ficam no Inspetor.'
            : player.spawnIfMissing
                ? 'Sem ator possuível na cena, o personagem do jogador nasce no ponto de início ao simular e some ao parar.'
                : 'Nada é criado ao simular; coloque um ator de personagem na cena para possuí-lo.'}
      </Hint>
      <ActionRow>
        <ActionButton icon={Plus} variant="primary" disabled={disabled || running} onClick={() => addCharacter(session)}>
          Adicionar à cena
        </ActionButton>
        <ActionButton icon={Copy} disabled={disabled || actors.length === 0} onClick={() => applyPlayerProfileToActors(session)}>
          Aplicar a {actors.length} {actors.length === 1 ? 'ator' : 'atores'}
        </ActionButton>
      </ActionRow>
      <Hint>Atores adicionados começam como cópia deste perfil e depois são editados um a um no Inspetor; "Aplicar" copia o perfil de volta para todos (com desfazer).</Hint>
    </CollapsibleSection>);
}
function RuntimeSection() {
    const session = useEditorState();
    const possessed = session.playtest.characters?.possessed ?? null;
    if (!possessed)
        return null;
    return (<CollapsibleSection title="Em simulação">
      <CharacterRuntimeReadout entity={possessed.entity}/>
    </CollapsibleSection>);
}
export function CharacterPanel() {
    const session = useEditorState();
    const models = useCharacterModels();
    const { player } = session.scene;
    const { character } = player;
    const asset = models.find((model) => model.id === character.model) ?? null;
    const disabled = !player.enabled;
    const running = session.playtest.isRunning;
    return (<div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
          <PersonStanding className="size-4" aria-hidden/>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-foreground">Personagem do jogador</span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {player.enabled ? `${asset?.label ?? 'Modelo ausente'} · ${Number(character.height.toFixed(2))} m · ${Number(character.runSpeed.toFixed(1))} m/s` : 'desligado · controle por código'}
            {running && player.enabled ? ' · em simulação' : ''}
          </span>
        </div>
        <IconButton label="Restaurar perfil padrão" size="sm" onClick={() => resetPlayerSettings(session)}>
          <RotateCcw />
        </IconButton>
        <ToggleSwitch label="Personagem do jogador ativo" on={player.enabled} onToggle={() => setPlayerEnabled(session, !player.enabled)}/>
      </div>

      <div className="flex-1 overflow-auto">
        {disabled && (<div className="border-b border-border">
            <Hint>Desligado: a simulação não cria nem possui personagem algum e os atores de personagem da cena ficam inertes. O projeto assume o controle por código, do zero, pela API de script da engine (em breve). Religue para voltar ao personagem padrão.</Hint>
          </div>)}

        <ModelSection disabled={disabled}/>

        <CollapsibleSection title="Cápsula">
          <CharacterSliders sliders={CAPSULE_SLIDERS} disabled={disabled}/>
          <Hint>A altura também dimensiona o modelo: cápsula e malha crescem juntas.</Hint>
        </CollapsibleSection>

        <CollapsibleSection title="Locomoção">
          <SubHeading>Velocidades</SubHeading>
          <CharacterSliders sliders={SPEED_SLIDERS} disabled={disabled}/>
          <SubHeading>Pulo e terreno</SubHeading>
          <CharacterSliders sliders={JUMP_SLIDERS} disabled={disabled}/>
        </CollapsibleSection>

        <CollapsibleSection title="Câmera">
          <SubHeading>Distância</SubHeading>
          <CameraSliders sliders={CAMERA_DISTANCE_SLIDERS} disabled={disabled}/>
          <SubHeading>Inclinação</SubHeading>
          <CameraSliders sliders={CAMERA_PITCH_SLIDERS} disabled={disabled}/>
          <SubHeading>Controle</SubHeading>
          <SliderField label="Sensibilidade" value={player.camera.sensitivity} min={0.02} max={0.5} step={0.01} format={degreesPerPixel} disabled={disabled} onChange={(value) => setPlayerCameraScalar(session, 'sensitivity', value)}/>
          <SliderField label="Altura do pivô" value={player.camera.pivotHeight} min={0.3} max={1.2} step={0.01} format={percent} disabled={disabled} onChange={(value) => setPlayerCameraScalar(session, 'pivotHeight', value)}/>
          <ToggleField label="Inverter eixo Y" on={player.camera.invertY} onToggle={() => setPlayerCameraInvertY(session, !player.camera.invertY)}/>
          <Hint>Fração da altura do personagem onde fica o pivô da câmera; 85% aproxima os ombros. Mudanças valem na hora, mesmo durante a simulação.</Hint>
        </CollapsibleSection>

        <AnimationSection />
        <SceneSection disabled={disabled}/>
        <RuntimeSection />
      </div>
    </div>);
}
