'use client';
import { ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PropertyRow } from '@/engine/ui/property-row';
import type { Entity } from '@/engine/core/scene/entity';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { CSG_COLLISION_LABEL, csgCollisionState, useMeshColliderForCsg, type CsgCollisionState, } from '@/engine/editor/operations/csg-physics-operations';
import { cn } from '@/lib/utils';
const STATE_ICON: Record<CsgCollisionState, LucideIcon> = { none: ShieldOff, mesh: ShieldCheck, primitive: ShieldAlert, dynamic: ShieldAlert };
const STATE_CLASS: Record<CsgCollisionState, string> = {
    none: 'text-muted-foreground',
    mesh: 'text-csg-union',
    primitive: 'text-csg-subtract',
    dynamic: 'text-csg-subtract',
};
const STATE_HINT: Record<CsgCollisionState, string> = {
    none: 'Nada colide com este ator: personagens e corpos o atravessam inteiro.',
    mesh: 'O colisor segue a malha esculpida ao vivo: furos e recortes são atravessáveis.',
    primitive: 'O colisor primitivo foi ajustado à malha original e continua fechando os furos.',
    dynamic: 'Corpos dinâmicos não aceitam colisor de malha; usar malha o torna estático.',
};
export function CsgCollisionRow({ target }: {
    target: Entity;
}) {
    const session = useEditorState();
    const state = csgCollisionState(target);
    const Icon = STATE_ICON[state];
    return (<PropertyRow label="Colisão">
      <div className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-sm border border-border bg-input px-2" title={STATE_HINT[state]}>
        <Icon className={cn('size-3 shrink-0', STATE_CLASS[state])} aria-hidden/>
        <span className="min-w-0 flex-1 truncate text-2xs text-foreground">{CSG_COLLISION_LABEL[state]}</span>
        {state !== 'mesh' && (<button type="button" onClick={() => useMeshColliderForCsg(session, target)} className="shrink-0 rounded-xs px-1 text-[10px] font-medium text-primary hover:bg-highlight">
            {state === 'none' ? 'Adicionar' : 'Usar malha'}
          </button>)}
      </div>
    </PropertyRow>);
}
