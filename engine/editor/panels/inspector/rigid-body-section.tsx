'use client';
import { Atom, Scan, Trash2 } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { SliderField } from '@/engine/ui/slider-field';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ToggleField } from '@/engine/ui/toggle-field';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { BodyType, RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { densityForSettings } from '@/engine/physics/body/collider-fit';
import type { ColliderKind } from '@/engine/physics/shapes/collider-shape';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { addRigidBody, fitRigidBodyToMesh, removeRigidBody, setRigidBodyCanSleep, setRigidBodyCollider, setRigidBodyScalar, setRigidBodyType, setRigidBodyVectorComponent, } from '@/engine/editor/operations/physics-operations';
import { ScalarField, Vector3Input } from './number-fields';
import { GHOST_ACTION_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
const BODY_TYPES: ReadonlyArray<{
    value: BodyType;
    label: string;
}> = [
    { value: 'dynamic', label: 'Dinâmico' },
    { value: 'kinematic', label: 'Cinemático' },
    { value: 'static', label: 'Estático' },
];
const COLLIDERS: ReadonlyArray<{
    value: ColliderKind;
    label: string;
}> = [
    { value: 'box', label: 'Caixa' },
    { value: 'sphere', label: 'Esfera' },
    { value: 'capsule', label: 'Cápsula' },
    { value: 'mesh', label: 'Malha' },
];
const STATIC_ONLY_BODY_TYPES = BODY_TYPES.filter((option) => option.value !== 'dynamic');
function AddRigidBodyPrompt({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const hint = useShortcutHint();
    return (<CollapsibleSection title="Física">
      <div className="flex flex-col gap-1.5 px-2 py-1">
        <button type="button" onClick={() => addRigidBody(session, entity)} className={cn('flex h-7 items-center justify-center gap-1.5 text-2xs font-medium text-foreground', GHOST_ACTION_CLASS)}>
          <Atom className="size-3.5 text-primary" aria-hidden/>
          Adicionar corpo rígido
        </button>
        <p className="text-3xs leading-relaxed text-pretty text-muted-foreground">
          O colisor é ajustado à malha e a massa, derivada do volume. Pressione {hint('Simular', 'simulation.playPause')} para ver a física.
        </p>
      </div>
    </CollapsibleSection>);
}
function formatDensity(density: number): string {
    if (!Number.isFinite(density))
        return '∞';
    return density >= 100 ? Math.round(density).toString() : density.toFixed(1);
}
function BuoyancyReadout({ entity, settings }: {
    entity: Entity;
    settings: RigidBodySettings;
}) {
    const session = useEditorSession();
    const density = densityForSettings(settings, entity.transform.scale);
    const waterDensity = Math.max(session.scene.physics.waterDensity, 1);
    const floats = density < waterDensity;
    const submerged = Math.round(Math.min(density / waterDensity, 1) * 100);
    const verdict = floats ? `boia (${submerged}%)` : 'afunda';
    const explanation = floats
        ? `Boia com ${submerged}% do volume submerso: a massa dividida pelo volume do colisor fica abaixo da densidade da água (${Math.round(waterDensity)} kg/m³, ajustável no painel Física).`
        : `Afunda: a massa dividida pelo volume do colisor passa da densidade da água (${Math.round(waterDensity)} kg/m³, ajustável no painel Física).`;
    return (<PropertyRow label="Densidade">
      <FieldInput readOnly value={`${formatDensity(density)} kg/m³ · ${verdict}`} title={explanation} aria-label="Densidade do corpo e flutuação"/>
    </PropertyRow>);
}
function RuntimeReadout({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const binding = session.playtest.physics?.bindingOf(entity) ?? null;
    if (!binding)
        return null;
    const { body } = binding;
    const state = body.outOfBounds
        ? 'Fora dos limites'
        : body.sleeping
            ? 'Dormindo'
            : body.isStatic
                ? 'Estático'
                : body.isKinematic
                    ? body.isMoving
                        ? 'Cinemático em movimento'
                        : 'Cinemático parado'
                    : 'Ativo';
    return (<>
      <PropertyRow label="Estado">
        <FieldInput readOnly value={state} aria-label="Estado do corpo"/>
      </PropertyRow>
      {!body.isStatic && (<>
          <PropertyRow label="Velocidade">
            <FieldInput readOnly value={`${vec3.length(body.linearVelocity).toFixed(2)} m/s`} aria-label="Velocidade linear"/>
          </PropertyRow>
          <PropertyRow label="Rotação">
            <FieldInput readOnly value={`${vec3.length(body.angularVelocity).toFixed(2)} rad/s`} aria-label="Velocidade angular"/>
          </PropertyRow>
        </>)}
    </>);
}
export function RigidBodySection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const settings = entity.rigidBody;
    if (!settings) {
        if (entity.csgBrush)
            return null;
        if (entity.kind !== 'mesh' && entity.kind !== 'group')
            return null;
        return <AddRigidBodyPrompt entity={entity}/>;
    }
    const dynamic = settings.type === 'dynamic';
    const meshCollider = settings.collider === 'mesh';
    const colliders = entity.mesh ? COLLIDERS : COLLIDERS.filter((option) => option.value !== 'mesh');
    const triangleCount = entity.mesh ? entity.mesh.indices.length / 3 : 0;
    return (<CollapsibleSection title="Corpo rígido" trailing={<div className="flex items-center">
          {entity.mesh && (<IconButton label="Ajustar colisor à malha" size="xs" onClick={() => fitRigidBodyToMesh(session, entity)}>
              <Scan />
            </IconButton>)}
          <IconButton label="Remover corpo rígido" size="xs" className="hover:text-destructive" onClick={() => removeRigidBody(session, entity)}>
            <Trash2 />
          </IconButton>
        </div>}>
      <PropertyRow label="Tipo">
        <SegmentedControl label="Tipo de corpo" options={meshCollider ? STATIC_ONLY_BODY_TYPES : BODY_TYPES} value={settings.type} onChange={(type) => setRigidBodyType(session, entity, type)}/>
      </PropertyRow>
      <PropertyRow label="Colisor">
        <SegmentedControl label="Forma do colisor" options={colliders} value={settings.collider} onChange={(kind) => setRigidBodyCollider(session, entity, kind)}/>
      </PropertyRow>

      {meshCollider && (<>
          <PropertyRow label="Triângulos">
            <FieldInput readOnly value={triangleCount.toLocaleString('pt-BR')} aria-label="Triângulos do colisor de malha"/>
          </PropertyRow>
          <p className="px-2 pb-1 text-3xs leading-relaxed text-pretty text-muted-foreground">
            Segue a malha ao vivo, inclusive furos e recortes de CSG. Personagens, esferas, cápsulas e caixas colidem com ela; dois colisores de malha
            não colidem entre si.
          </p>
        </>)}
      {settings.collider === 'box' && (<PropertyRow label="Tamanho">
          <Vector3Input label="Tamanho do colisor" values={settings.boxSize} onCommit={(axis, value) => setRigidBodyVectorComponent(session, entity, 'boxSize', axis, value)}/>
        </PropertyRow>)}
      {(settings.collider === 'sphere' || settings.collider === 'capsule') && (<PropertyRow label="Raio">
          <ScalarField label="Raio do colisor" value={settings.radius} onCommit={(value) => setRigidBodyScalar(session, entity, 'radius', value)}/>
        </PropertyRow>)}
      {settings.collider === 'capsule' && (<PropertyRow label="Altura">
          <ScalarField label="Altura do colisor" value={settings.height} onCommit={(value) => setRigidBodyScalar(session, entity, 'height', value)}/>
        </PropertyRow>)}
      {!meshCollider && (<PropertyRow label="Centro">
          <Vector3Input label="Centro do colisor" values={settings.center} onCommit={(axis, value) => setRigidBodyVectorComponent(session, entity, 'center', axis, value)}/>
        </PropertyRow>)}

      {dynamic && (<>
          <PropertyRow label="Massa">
            <ScalarField label="Massa" value={settings.mass} suffix=" kg" onCommit={(value) => setRigidBodyScalar(session, entity, 'mass', value)}/>
          </PropertyRow>
          <BuoyancyReadout entity={entity} settings={settings}/>
        </>)}
      <SliderField label="Atrito" value={settings.friction} min={0} max={1} onChange={(value) => setRigidBodyScalar(session, entity, 'friction', value)}/>
      <SliderField label="Restituição" value={settings.restitution} min={0} max={1} onChange={(value) => setRigidBodyScalar(session, entity, 'restitution', value)}/>

      {dynamic && (<>
          <SliderField label="Amort. linear" value={settings.linearDamping} min={0} max={5} onChange={(value) => setRigidBodyScalar(session, entity, 'linearDamping', value)}/>
          <SliderField label="Amort. angular" value={settings.angularDamping} min={0} max={5} onChange={(value) => setRigidBodyScalar(session, entity, 'angularDamping', value)}/>
          <PropertyRow label="Gravidade">
            <ScalarField label="Escala de gravidade" value={settings.gravityScale} suffix="×" onCommit={(value) => setRigidBodyScalar(session, entity, 'gravityScale', value)}/>
          </PropertyRow>
          <ToggleField label="Pode dormir" on={settings.canSleep} onToggle={() => setRigidBodyCanSleep(session, entity, !settings.canSleep)}/>
        </>)}

      <RuntimeReadout entity={entity}/>
    </CollapsibleSection>);
}
