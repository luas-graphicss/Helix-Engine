'use client';
import { Bone, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEMANTIC_BONE_LABELS, SEMANTIC_BONES, type SemanticBone } from '@/engine/core/animation/bone-roles';
import type { Entity } from '@/engine/core/scene/entity';
import type { Rig } from '@/engine/core/scene/rig';
import { applyRigBindPose } from '@/engine/editor/operations/rig-operations';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
function jointOf(entity: Entity): {
    rig: Rig;
    owner: Entity;
    joint: number;
} | null {
    let ancestor: Entity | null = entity.parent;
    while (ancestor) {
        const rig: Rig | null = ancestor.rig;
        if (rig) {
            const joint = rig.jointIndex(entity);
            return joint === -1 ? null : { rig, owner: ancestor, joint };
        }
        ancestor = ancestor.parent;
    }
    return null;
}
function RoleChips({ rig }: {
    rig: Rig;
}) {
    const session = useEditorState();
    return (<ul className="flex flex-wrap gap-1 px-2 pb-1" aria-label="Papéis reconhecidos">
      {SEMANTIC_BONES.map((bone: SemanticBone) => {
            const joint = rig.semantic[bone];
            const found = joint !== -1;
            const label = SEMANTIC_BONE_LABELS[bone];
            return (<li key={bone}>
            <button type="button" disabled={!found} onClick={() => session.select(rig.joints[joint])} title={found ? `${label}: ${rig.names[joint]} (clique para selecionar)` : `${label}: não encontrado`} className={cn('rounded-sm border px-1 py-px text-[10px] leading-4', found ? 'border-border text-foreground hover:border-primary hover:text-primary' : 'cursor-default border-dashed border-border/60 text-muted-foreground/60')}>
              {label}
            </button>
          </li>);
        })}
    </ul>);
}
export function RigSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const rig = entity.rig;
    if (!rig)
        return null;
    const roots = rig.rootJoints();
    return (<CollapsibleSection title="Rig" trailing={<span className="flex items-center gap-1 text-[10px] text-axis-y">
          <Bone className="size-3" aria-hidden/>
          {rig.profile.humanoid ? 'Humanoide' : 'Esqueleto'}
        </span>}>
      <PropertyRow label="Nome">
        <FieldInput readOnly value={rig.name} aria-label="Nome do rig"/>
      </PropertyRow>
      <PropertyRow label="Ossos">
        <FieldInput readOnly value={`${rig.jointCount} · raiz ${roots.map((joint) => rig.names[joint]).join(', ') || '—'}`} aria-label="Ossos"/>
      </PropertyRow>
      <PropertyRow label="Convenção">
        <FieldInput readOnly value={`${rig.profile.convention} · ${rig.profile.matched}/${rig.profile.total} papéis`} aria-label="Convenção de nomes"/>
      </PropertyRow>
      {rig.unitScale !== 1 && (<PropertyRow label="Unidade">
          <FieldInput readOnly value={`${rig.unitScale.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m por unidade`} aria-label="Escala das translações"/>
        </PropertyRow>)}
      <RoleChips rig={rig}/>
      <ActionRow>
        <ActionButton icon={RotateCcw} className="flex-1" title="Devolve todas as juntas à pose de repouso do arquivo (desfazível)" onClick={() => applyRigBindPose(session, entity)}>
          Pose de repouso
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
export function BoneSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const membership = jointOf(entity);
    if (!membership)
        return null;
    const { rig, owner, joint } = membership;
    const role = rig.roleOf(joint);
    const parent = rig.parents[joint];
    return (<CollapsibleSection title="Osso">
      <PropertyRow label="Rig">
        <button type="button" onClick={() => session.select(owner)} className="min-w-0 truncate text-left font-mono text-2xs text-primary hover:underline" title={`Selecionar ${owner.name}`}>
          {rig.name}
        </button>
      </PropertyRow>
      <PropertyRow label="Papel">
        <FieldInput readOnly value={role ? SEMANTIC_BONE_LABELS[role] : 'Sem papel reconhecido'} aria-label="Papel do osso"/>
      </PropertyRow>
      <PropertyRow label="Pai">
        <FieldInput readOnly value={parent === -1 ? 'Raiz do esqueleto' : rig.names[parent]} aria-label="Osso pai"/>
      </PropertyRow>
      <PropertyRow label="Filhos">
        <FieldInput readOnly value={String(rig.childrenOf(joint).length)} aria-label="Ossos filhos"/>
      </PropertyRow>
    </CollapsibleSection>);
}
