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
import type { BodyType } from '@/engine/physics/body/rigid-body-settings';
import type { ColliderKind } from '@/engine/physics/shapes/collider-shape';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { addRigidBody, fitRigidBodyToMesh, removeRigidBody, setRigidBodyCanSleep, setRigidBodyCollider, setRigidBodyScalar, setRigidBodyType, setRigidBodyVectorComponent, } from '@/engine/editor/operations/physics-operations';
import { ScalarField, Vector3Input } from './number-fields';
const BODY_TYPES: ReadonlyArray<{
    value: BodyType;
    label: string;
}> = [
    { value: 'dynamic', label: 'Dinâmico' },
    { value: 'static', label: 'Estático' },
];
const COLLIDERS: ReadonlyArray<{
    value: ColliderKind;
    label: string;
}> = [
    { value: 'box', label: 'Caixa' },
    { value: 'sphere', label: 'Esfera' },
    { value: 'capsule', label: 'Cápsula' },
];
function AddRigidBodyPrompt({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    return (<CollapsibleSection title="Física">
      <div className="flex flex-col gap-1.5 px-2 py-1">
        <button type="button" onClick={() => addRigidBody(session, entity)} className="flex h-7 items-center justify-center gap-1.5 rounded-sm border border-dashed border-border-strong text-2xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-highlight">
          <Atom className="size-3.5 text-primary" aria-hidden/>
          Adicionar corpo rígido
        </button>
        <p className="text-[10px] leading-relaxed text-pretty text-muted-foreground">
          O colisor é ajustado à malha e a massa, derivada do volume. Pressione Simular (Ctrl+P) para ver a física.
        </p>
      </div>
    </CollapsibleSection>);
}
function RuntimeReadout({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const binding = session.playtest.physics?.bindingOf(entity) ?? null;
    if (!binding)
        return null;
    const { body } = binding;
    const state = body.outOfBounds ? 'Fora dos limites' : body.sleeping ? 'Dormindo' : body.isStatic ? 'Estático' : 'Ativo';
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
    const session = useEditorState();
    const settings = entity.rigidBody;
    if (!settings) {
        if (entity.kind !== 'mesh' && entity.kind !== 'group')
            return null;
        return <AddRigidBodyPrompt entity={entity}/>;
    }
    const dynamic = settings.type === 'dynamic';
    return (<CollapsibleSection title="Corpo rígido" trailing={<div className="flex items-center">
          {entity.mesh && (<IconButton label="Ajustar colisor à malha" size="sm" className="size-5 [&_svg]:size-3" onClick={() => fitRigidBodyToMesh(session, entity)}>
              <Scan />
            </IconButton>)}
          <IconButton label="Remover corpo rígido" size="sm" className="size-5 hover:text-destructive [&_svg]:size-3" onClick={() => removeRigidBody(session, entity)}>
            <Trash2 />
          </IconButton>
        </div>}>
      <PropertyRow label="Tipo">
        <SegmentedControl label="Tipo de corpo" options={BODY_TYPES} value={settings.type} onChange={(type) => setRigidBodyType(session, entity, type)}/>
      </PropertyRow>
      <PropertyRow label="Colisor">
        <SegmentedControl label="Forma do colisor" options={COLLIDERS} value={settings.collider} onChange={(kind) => setRigidBodyCollider(session, entity, kind)}/>
      </PropertyRow>

      {settings.collider === 'box' && (<PropertyRow label="Tamanho">
          <Vector3Input label="Tamanho do colisor" values={settings.boxSize} onCommit={(axis, value) => setRigidBodyVectorComponent(session, entity, 'boxSize', axis, value)}/>
        </PropertyRow>)}
      {settings.collider !== 'box' && (<PropertyRow label="Raio">
          <ScalarField label="Raio do colisor" value={settings.radius} onCommit={(value) => setRigidBodyScalar(session, entity, 'radius', value)}/>
        </PropertyRow>)}
      {settings.collider === 'capsule' && (<PropertyRow label="Altura">
          <ScalarField label="Altura do colisor" value={settings.height} onCommit={(value) => setRigidBodyScalar(session, entity, 'height', value)}/>
        </PropertyRow>)}
      <PropertyRow label="Centro">
        <Vector3Input label="Centro do colisor" values={settings.center} onCommit={(axis, value) => setRigidBodyVectorComponent(session, entity, 'center', axis, value)}/>
      </PropertyRow>

      {dynamic && (<PropertyRow label="Massa">
          <ScalarField label="Massa" value={settings.mass} suffix=" kg" onCommit={(value) => setRigidBodyScalar(session, entity, 'mass', value)}/>
        </PropertyRow>)}
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
