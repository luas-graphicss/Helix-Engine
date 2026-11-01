'use client';
import { FolderOpen, Import, Plus, Sparkles } from 'lucide-react';
import { createVfxEffect, importVfxEffects, openVfxAssetInEditor } from '@/engine/editor/operations/vfx-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { ActionButton } from '@/engine/ui/action-button';
import { VfxTemplateMenu } from './vfx-template-menu';
const MAX_RECENT = 6;
export function VfxEmptyState() {
    const session = useSessionTopic('assets');
    const effects = session.library.byKind('vfx').slice(0, MAX_RECENT);
    return (<div className="flex h-full flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-3 text-center">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Sparkles className="size-4" aria-hidden/>
        <span className="text-2xs">Nenhum efeito aberto</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <VfxTemplateMenu align="start" onPick={(templateId) => void createVfxEffect(session, templateId)} trigger={<ActionButton icon={Plus} variant="primary" className="flex-none"/>}>
          Novo efeito
        </VfxTemplateMenu>
        {effects.map((asset) => (<ActionButton key={asset.id} icon={FolderOpen} className="max-w-40 flex-none" title={`Abrir ${asset.name}`} onClick={() => void openVfxAssetInEditor(session, asset)}>
            <span className="truncate">{asset.name}</span>
          </ActionButton>))}
        <ActionButton icon={Import} className="flex-none" title="Importar arquivos .hxvfx para a biblioteca" onClick={() => void importVfxEffects(session)}>
          Importar
        </ActionButton>
      </div>
      <p className="max-w-md text-3xs leading-relaxed text-pretty text-muted-foreground">
        Um efeito é uma pilha de emissores: cada um sorteia partículas numa forma e as passa por módulos que as movem e colorem ao longo da vida. Enquanto você edita, o efeito toca ao vivo num ator-palco da cena.
      </p>
    </div>);
}
