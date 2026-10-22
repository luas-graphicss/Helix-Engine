'use client';
import { Diff, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ToggleField } from '@/engine/ui/toggle-field';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import type { Entity } from '@/engine/core/scene/entity';
import { brushesOf, listCsgTargets } from '@/engine/geometry/csg/csg-roles';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { csgCollisionStale, csgCollisionState, fixAllCsgCollisions, removeCsgCollision, useMeshColliderForCsg, type CsgCollisionState, } from '@/engine/editor/operations/csg-physics-operations';
import { cn } from '@/lib/utils';
const STATE_ICON: Record<CsgCollisionState, LucideIcon> = { none: ShieldOff, mesh: ShieldCheck, primitive: ShieldAlert, dynamic: ShieldAlert };
const STATE_CLASS: Record<CsgCollisionState, string> = {
    none: 'text-muted-foreground',
    mesh: 'text-csg-union',
    primitive: 'text-csg-subtract',
    dynamic: 'text-csg-subtract',
};
const STATE_SHORT: Record<CsgCollisionState, string> = { none: 'sem colisão', mesh: 'malha', primitive: 'primitivo', dynamic: 'dinâmico' };
function TargetRow({ target }: {
    target: Entity;
}) {
    const session = useEditorState();
    const state = csgCollisionState(target);
    const Icon = STATE_ICON[state];
    const brushes = brushesOf(target).length;
    return (<div className="flex h-6 items-center gap-1.5 px-2">
      <Icon className={cn('size-3 shrink-0', STATE_CLASS[state])} aria-hidden/>
      <button type="button" onClick={() => session.select(target)} className="min-w-0 flex-1 truncate text-left text-2xs text-foreground hover:underline" title={`Selecionar ${target.name}`}>
        {target.name}
      </button>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {brushes} {brushes === 1 ? 'pincel' : 'pincéis'} · {STATE_SHORT[state]}
      </span>
      {state === 'mesh' ? (<button type="button" onClick={() => removeCsgCollision(session, target)} className="shrink-0 rounded-xs px-1 text-[10px] text-muted-foreground hover:bg-highlight hover:text-foreground" title="Remover a colisão: o ator passa a ser atravessável">
          Remover
        </button>) : (<button type="button" onClick={() => useMeshColliderForCsg(session, target)} className="shrink-0 rounded-xs px-1 text-[10px] font-medium text-primary hover:bg-highlight" title="Colisor de malha: acompanha furos e recortes ao vivo">
          {state === 'none' ? 'Adicionar' : 'Usar malha'}
        </button>)}
    </div>);
}
export function CsgCollisionSection() {
    const session = useEditorState();
    const targets = listCsgTargets(session.scene);
    const stale = targets.filter(csgCollisionStale).length;
    const { csgPreferences } = session;
    return (<CollapsibleSection title="CSG">
      <ToggleField label="Colisor de malha automático" on={csgPreferences.autoMeshCollider} onToggle={() => session.updateCsgPreferences({ autoMeshCollider: !csgPreferences.autoMeshCollider })}/>
      <ToggleField label="Adiar alvos pesados no arrasto" on={csgPreferences.deferHeavyWhileDragging} onToggle={() => session.updateCsgPreferences({ deferHeavyWhileDragging: !csgPreferences.deferHeavyWhileDragging })}/>
      <p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        Um ator que vira alvo CSG ganha um colisor de malha estático (ou troca o primitivo que tinha), e o colisor é refeito a cada reconstrução:
        personagens, caixas e esferas passam pelos furos. Pincéis nunca colidem; corpos dinâmicos mantêm o colisor primitivo até você trocar.
      </p>
      <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
        <span className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          <Diff className="size-3" aria-hidden/>
          Alvos{targets.length > 0 ? ` · ${targets.length}` : ''}
        </span>
        {stale > 0 && <span className="text-[10px] text-csg-subtract">{stale} {stale === 1 ? 'ignora furos' : 'ignoram furos'}</span>}
      </div>
      {targets.length === 0 ? (<p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
          Nenhum alvo CSG na cena. Selecione uma malha e pressione B para subtrair um pincel.
        </p>) : (targets.map((target) => <TargetRow key={target.id} target={target}/>))}
      {stale > 0 && (<ActionRow>
          <ActionButton icon={ShieldCheck} variant="primary" onClick={() => fixAllCsgCollisions(session, targets)} title="Dá colisor de malha a todos os alvos cuja colisão ignora o CSG">
            Usar malha em todos
          </ActionButton>
        </ActionRow>)}
    </CollapsibleSection>);
}
