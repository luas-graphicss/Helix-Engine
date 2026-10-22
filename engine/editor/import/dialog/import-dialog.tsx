'use client';
import { useState } from 'react';
import { Import, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatLabel, isModelFile } from '@/engine/assets/import/import-registry';
import type { ImportedScene } from '@/engine/assets/import/import-types';
import type { ImportOptions, ParsedImport } from '@/engine/editor/operations/import-operations';
import { useFileDrop } from '@/engine/editor/viewport/use-file-drop';
import { IconButton } from '@/engine/ui/icon-button';
import { TabStrip, type TabDefinition } from '@/engine/ui/tab-strip';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { ImportPreview } from '../preview/import-preview';
import { useImportDraft } from '../use-import-draft';
import { formatInteger } from './import-format';
import { ImportMaterialsTab } from './import-materials-tab';
import { ImportMeshesTab } from './import-meshes-tab';
import { ImportOptionsTab } from './import-options-tab';
import { ImportTexturesTab } from './import-textures-tab';
import { StatusBadge } from './status-badge';
import { useImportPreview } from './use-import-preview';
type ImportTab = 'options' | 'meshes' | 'materials' | 'textures';
type ImportDialogProps = {
    parsed: ParsedImport;
    companionFiles: File[];
    position: {
        index: number;
        total: number;
    };
    onImport: (scene: ImportedScene, options: ImportOptions, sourceFiles: File[]) => Promise<void>;
    onSkip: () => void;
    onCancel: () => void;
    onPreviewError: (message: string) => void;
};
export function ImportDialog({ parsed, companionFiles, position, onImport, onSkip, onCancel, onPreviewError }: ImportDialogProps) {
    const draft = useImportDraft(parsed.scene, companionFiles);
    const preview = useImportPreview(draft.scene, draft.options, draft.revision, onPreviewError);
    const [tab, setTab] = useState<ImportTab>('options');
    const [importing, setImporting] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const addCompanionFiles = (files: File[]) => {
        const resolved = draft.addCompanionFiles(files);
        setNotice(resolved > 0
            ? `${resolved} ${resolved === 1 ? 'textura vinculada' : 'texturas vinculadas'} a partir de ${files.length} ${files.length === 1 ? 'arquivo' : 'arquivos'}.`
            : `Nenhuma textura ausente corresponde aos ${files.length} ${files.length === 1 ? 'arquivo adicionado' : 'arquivos adicionados'}; edite o caminho ou escolha o arquivo manualmente.`);
        setTab('textures');
    };
    const drop = useFileDrop(addCompanionFiles);
    const { scene, stats, options, warnings } = draft;
    const includedMeshes = scene.meshes.length - options.excludedMeshes.size;
    const hasMultiple = position.total > 1;
    const tabs: TabDefinition[] = [
        { id: 'options', label: 'Opções', badge: warnings.length > 0 ? { label: String(warnings.length), tone: 'warning' } : undefined },
        { id: 'meshes', label: 'Malhas', badge: { label: includedMeshes === scene.meshes.length ? String(scene.meshes.length) : `${includedMeshes}/${scene.meshes.length}` } },
        { id: 'materials', label: 'Materiais', badge: { label: String(scene.materials.length) } },
        {
            id: 'textures',
            label: 'Texturas',
            badge: stats.missingTextures > 0 ? { label: `${stats.missingTextures} ausente${stats.missingTextures === 1 ? '' : 's'}`, tone: 'warning' } : { label: String(scene.textures.length) },
        },
    ];
    const handleImport = async () => {
        setImporting(true);
        try {
            await onImport(scene, options, draft.files.filter((file) => file === parsed.file || !isModelFile(file)));
        }
        finally {
            setImporting(false);
        }
    };
    return (<Dialog open disablePointerDismissal onOpenChange={(open) => {
            if (!open && !importing)
                onCancel();
        }}>
      <DialogContent showCloseButton={false} aria-busy={importing} {...drop.handlers} className={cn('flex h-[min(780px,calc(100dvh-2rem))] w-[min(1240px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-sm border border-border-strong bg-surface p-0 text-foreground shadow-2xl ring-0 sm:max-w-none', drop.active && 'outline-2 outline-offset-[-2px] outline-primary outline-dashed')}>
        <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Import className="size-4 shrink-0 text-primary" aria-hidden/>
            <DialogTitle className="shrink-0 text-xs font-semibold">Importar modelo</DialogTitle>
            <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground" title={parsed.file.name}>
              {parsed.file.name}
            </span>
            <StatusBadge tone="primary">{formatLabel(scene.format)}</StatusBadge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasMultiple && (<span className="font-mono text-2xs text-muted-foreground">
                {position.index + 1} de {position.total}
              </span>)}
            <IconButton label="Cancelar importação" size="sm" onClick={onCancel} disabled={importing}>
              <X />
            </IconButton>
          </div>
        </header>
        <DialogDescription className="sr-only">
          Ajuste escala, eixo, normais, malhas e texturas e veja o resultado na pré-visualização antes de inserir o modelo na cena.
        </DialogDescription>

        <div className="flex min-h-0 flex-1">
          <ImportPreview model={preview.model} texturesVisible={preview.texturesVisible} onTexturesVisibleChange={preview.setTexturesVisible} building={preview.building} dimensions={preview.dimensions} triangles={preview.triangles}/>
          <aside className="flex w-[460px] shrink-0 flex-col border-l border-border bg-surface" aria-label="Configurações da importação">
            <div className="h-8 shrink-0 border-b border-border bg-surface-raised/60">
              <TabStrip tabs={tabs} activeId={tab} onChange={(id) => setTab(id as ImportTab)}/>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'options' && <ImportOptionsTab draft={draft} fileSize={parsed.file.size}/>}
              {tab === 'meshes' && <ImportMeshesTab draft={draft}/>}
              {tab === 'materials' && <ImportMaterialsTab draft={draft}/>}
              {tab === 'textures' && <ImportTexturesTab draft={draft} notice={notice} onDismissNotice={() => setNotice(null)} onCompanionFiles={addCompanionFiles}/>}
            </div>
          </aside>
        </div>

        <footer className="flex h-11 shrink-0 items-center justify-between gap-3 border-t border-border bg-surface-raised/60 px-3">
          <div className="flex min-w-0 items-center gap-2 font-mono text-2xs text-muted-foreground">
            <span className="truncate">
              {formatInteger(stats.nodes)} {stats.nodes === 1 ? 'nó' : 'nós'} · {formatInteger(includedMeshes)} {includedMeshes === 1 ? 'malha' : 'malhas'} · {formatInteger(stats.materials)}{' '}
              {stats.materials === 1 ? 'material' : 'materiais'} · {formatInteger(stats.textures)} {stats.textures === 1 ? 'textura' : 'texturas'}
            </span>
            {stats.missingTextures > 0 && (<button type="button" onClick={() => setTab('textures')} className="flex shrink-0 items-center gap-1 text-warning hover:underline">
                <TriangleAlert className="size-3" aria-hidden/>
                {stats.missingTextures} {stats.missingTextures === 1 ? 'textura ausente' : 'texturas ausentes'}
              </button>)}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <label className="mr-2 flex cursor-pointer items-center gap-2 text-2xs text-muted-foreground" title="Guarda o arquivo (e seus auxiliares) na biblioteca de ativos para reutilizar em outras cenas">
              <ToggleSwitch label="Guardar na biblioteca" on={options.saveToLibrary} onToggle={() => draft.updateOptions({ saveToLibrary: !options.saveToLibrary })}/>
              Guardar na biblioteca
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={importing}>
              {hasMultiple ? 'Cancelar tudo' : 'Cancelar'}
            </Button>
            {hasMultiple && (<Button type="button" variant="outline" size="sm" onClick={onSkip} disabled={importing}>
                Pular
              </Button>)}
            <Button type="button" size="sm" onClick={() => void handleImport()} disabled={importing || includedMeshes === 0} title={includedMeshes === 0 ? 'Inclua ao menos uma malha' : undefined}>
              {importing ? <LoaderCircle className="animate-spin" aria-hidden/> : <Import aria-hidden/>}
              {importing ? 'Importando…' : hasMultiple && position.index + 1 < position.total ? 'Importar e avançar' : 'Importar'}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>);
}
