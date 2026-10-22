'use client';
import { Clapperboard, FolderOpen, Plus } from 'lucide-react';
import { ActionButton } from '@/engine/ui/action-button';
import { riggedEntities, rigDisplayName, rigOwnerOf } from '@/engine/editor/animation/animation-editor';
import { openAnimationAssetInEditor } from '@/engine/editor/operations/animation-operations';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
const MAX_RECENT = 6;
export function AnimationEmptyState() {
    const session = useEditorState();
    const rigged = riggedEntities(session);
    const selectedOwner = session.selectedEntity ? rigOwnerOf(session.selectedEntity) : null;
    const target = selectedOwner ?? rigged[0] ?? null;
    const animations = session.library.byKind('animation').slice(0, MAX_RECENT);
    return (<div className="flex h-full flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-3 text-center">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clapperboard className="size-4" aria-hidden/>
        <span className="text-2xs">Nenhuma animação aberta</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <ActionButton icon={Plus} variant="primary" className="flex-none" disabled={!target} onClick={() => target && session.animation.newClip(target)}>
          {target ? `Nova animação para ${rigDisplayName(target)}` : 'Nova animação'}
        </ActionButton>
        {animations.map((asset) => (<ActionButton key={asset.id} icon={FolderOpen} className="max-w-40 flex-none" title={`Abrir ${asset.name}`} disabled={!target} onClick={() => void openAnimationAssetInEditor(session, asset, target)}>
            <span className="truncate">{asset.name}</span>
          </ActionButton>))}
      </div>
      <p className="max-w-md text-[10px] leading-relaxed text-pretty text-muted-foreground">
        {target
            ? 'Selecione ossos no viewport, gire com o gizmo ou arraste mãos e pés com IK; as poses viram chaves na linha do tempo. Animações da biblioteca também abrem pelo menu de contexto delas.'
            : 'Adicione um personagem ou importe um modelo com esqueleto para animar.'}
      </p>
    </div>);
}
