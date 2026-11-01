'use client';
import { useMemo } from 'react';
import { ArrowLeft, FileUp, LayoutTemplate, Plus } from 'lucide-react';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { GUI_TEMPLATES } from '@/engine/gui/templates/gui-templates';
import { createGuiScreen, importGuiScreens, openGuiAssetInDesigner } from '@/engine/editor/operations/gui-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { ActionButton } from '@/engine/ui/action-button';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
import { GuiDocumentPreview } from './gui-document-preview';
import { EMPTY_NOTE_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
const PREVIEW_WIDTH = 208;
function ScreenCard({ asset, onOpen }: {
    asset: LibraryAsset;
    onOpen: () => void;
}) {
    const details = asset.details.kind === 'gui' ? asset.details : null;
    return (<button type="button" onClick={onOpen} className="group flex flex-col gap-2 rounded-sm border border-border bg-surface p-2 text-left transition-colors hover:border-primary/60 hover:bg-highlight focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary">
      <span className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xs bg-surface-sunken">
        {asset.thumbnail ? <ImageBlobThumbnail blob={asset.thumbnail.blob} alt=""/> : <LayoutTemplate className="size-6 text-muted-foreground" aria-hidden/>}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-2xs font-medium text-foreground">{asset.name}</span>
        {details && (<span className="truncate font-mono text-3xs text-muted-foreground">
            {details.referenceWidth} × {details.referenceHeight} · {details.elements} {details.elements === 1 ? 'elemento' : 'elementos'}
            {!details.enabled && ' · oculta no jogo'}
          </span>)}
      </span>
    </button>);
}
export function GuiEmptyState() {
    const session = useSessionTopic('assets', 'workspace');
    const screens = session.library.byKind('gui');
    const templates = useMemo(() => GUI_TEMPLATES.map((template) => ({ template, document: template.build() })), []);
    return (<div className="@container absolute inset-0 overflow-auto bg-surface-sunken">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 @2xl:gap-8 @2xl:px-8 @2xl:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-3xs tracking-wider text-primary uppercase">Designer de interface</span>
            <h1 className="text-base font-semibold text-balance text-foreground @2xl:text-lg">Monte a interface do jogo arrastando, desenhando e ajustando — como no Figma, com a lógica de telas do Roblox e da Unity.</h1>
            <p className="max-w-2xl text-2xs leading-relaxed text-pretty text-muted-foreground">
              Cada tela é um ativo <span className="font-mono">.hxgui</span> da biblioteca. Posições e tamanhos combinam uma parte proporcional com pixels, então a mesma tela se adapta a monitores, portáteis e celulares; o modo Testar roda botões, controles deslizantes e campos de texto de verdade.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ActionButton icon={FileUp} onClick={() => void importGuiScreens(session)}>
              Importar .hxgui…
            </ActionButton>
            <ActionButton icon={ArrowLeft} onClick={() => session.setWorkspace('scene')}>
              Voltar à cena
            </ActionButton>
          </div>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Começar com um modelo</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-3">
            {templates.map(({ template, document }) => (<button key={template.id} type="button" onClick={() => void createGuiScreen(session, template.id)} className="group flex flex-col gap-2 rounded-sm border border-border bg-surface p-2 text-left transition-colors hover:border-primary/60 hover:bg-highlight focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary">
                <span className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xs bg-surface-sunken">
                  {template.id === 'blank' ? <Plus className="size-6 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden/> : <GuiDocumentPreview document={document} width={PREVIEW_WIDTH} className="max-h-full max-w-full"/>}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-2xs font-medium text-foreground">{template.label}</span>
                  <span className="line-clamp-2 text-3xs leading-relaxed text-muted-foreground">{template.description}</span>
                </span>
              </button>))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Telas da biblioteca</h2>
          {screens.length === 0 ? (<p className={cn('px-4 py-6 text-center text-2xs', EMPTY_NOTE_CLASS)}>Nenhuma tela guardada ainda. Crie uma a partir de um modelo acima; ela é salva na biblioteca automaticamente.</p>) : (<div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-3">
              {screens.map((asset) => (<ScreenCard key={asset.id} asset={asset} onOpen={() => void openGuiAssetInDesigner(session, asset)}/>))}
            </div>)}
        </section>
      </div>
    </div>);
}
