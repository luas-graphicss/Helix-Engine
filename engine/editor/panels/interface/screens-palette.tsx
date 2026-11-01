'use client';
import { useMemo } from 'react';
import { FileUp, LayoutTemplate, Plus } from 'lucide-react';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { GUI_TEMPLATES } from '@/engine/gui/templates/gui-templates';
import { GuiDocumentPreview } from '@/engine/editor/gui/ui/gui-document-preview';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { createGuiScreen, importGuiScreens, openGuiAssetInDesigner } from '@/engine/editor/operations/gui-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton } from '@/engine/ui/action-button';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
import { cn } from '@/lib/utils';
import { EMPTY_NOTE_CLASS } from '@/engine/ui/surface-styles';
const PREVIEW_WIDTH = 128;
const CARD_CLASS = 'group flex w-36 shrink-0 flex-col gap-1.5 rounded-sm border border-border bg-surface p-1.5 text-left transition-colors hover:border-primary/60 hover:bg-highlight focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary';
function ScreenCard({ asset, active, onOpen }: {
    asset: LibraryAsset;
    active: boolean;
    onOpen: () => void;
}) {
    const details = asset.details.kind === 'gui' ? asset.details : null;
    return (<button type="button" onClick={onOpen} title={active ? `${asset.name} (aberta)` : `Abrir ${asset.name}`} className={cn(CARD_CLASS, active && 'border-primary/60 bg-primary/10')}>
      <span className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xs bg-surface-sunken">
        {asset.thumbnail ? <ImageBlobThumbnail blob={asset.thumbnail.blob} alt=""/> : <LayoutTemplate className="size-5 text-muted-foreground" aria-hidden/>}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={cn('truncate text-2xs font-medium', active ? 'text-primary' : 'text-foreground')}>{asset.name}</span>
        {details && (<span className="truncate font-mono text-3xs text-muted-foreground">
            {details.referenceWidth}×{details.referenceHeight} · {details.elements} el.{!details.enabled && ' · oculta'}
          </span>)}
      </span>
    </button>);
}
export function ScreensPalette() {
    const session = useEditorSession();
    const designer = useGuiDesigner();
    const screens = session.library.byKind('gui');
    const templates = useMemo(() => GUI_TEMPLATES.map((template) => ({ template, document: template.build() })), []);
    return (<div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-1.5">
        <span className="min-w-0 flex-1 basis-40 truncate text-2xs text-muted-foreground" title="Cada tela é um ativo .hxgui da biblioteca; a aberta é salva com Ctrl+S.">
          Cada tela é um ativo .hxgui da biblioteca; a aberta é salva com Ctrl+S.
        </span>
        <div className="ml-auto shrink-0">
          <ActionButton icon={FileUp} onClick={() => void importGuiScreens(session)}>
            Importar .hxgui…
          </ActionButton>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <section className="flex flex-col gap-1.5">
          <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Telas da biblioteca</h3>
          {screens.length === 0 ? (<p className={cn('px-3 py-3 text-2xs', EMPTY_NOTE_CLASS)}>Nenhuma tela guardada. Crie uma a partir de um modelo abaixo.</p>) : (<div className="flex gap-2 overflow-x-auto pb-1">
              {screens.map((asset) => (<ScreenCard key={asset.id} asset={asset} active={designer.assetId === asset.id} onOpen={() => void openGuiAssetInDesigner(session, asset)}/>))}
            </div>)}
        </section>
        <section className="flex flex-col gap-1.5">
          <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Nova tela a partir de um modelo</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {templates.map(({ template, document }) => (<button key={template.id} type="button" onClick={() => void createGuiScreen(session, template.id)} title={template.description} className={CARD_CLASS}>
                <span className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xs bg-surface-sunken">
                  {template.id === 'blank' ? <Plus className="size-5 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden/> : <GuiDocumentPreview document={document} width={PREVIEW_WIDTH} className="max-h-full max-w-full"/>}
                </span>
                <span className="truncate text-2xs font-medium text-foreground">{template.label}</span>
              </button>))}
          </div>
        </section>
      </div>
    </div>);
}
