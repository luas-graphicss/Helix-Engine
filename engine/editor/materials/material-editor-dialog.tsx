'use client';
import { useRef, useState } from 'react';
import { Images, Palette, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ActionButton } from '@/engine/ui/action-button';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { useFileDrop } from '@/engine/editor/viewport/use-file-drop';
import { importPbrFiles } from '@/engine/editor/operations/material-library-operations';
import type { MaterialDocument } from '@/engine/materials/material-document';
import { MaterialLibraryList } from './material-library-list';
import { MaterialPreview } from './material-preview';
import { MaterialProperties } from './material-properties';
import type { PreviewSettings } from './preview/preview-settings';
const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp';
type MaterialEditorDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    preview: PreviewSettings;
    onPreviewChange: (patch: Partial<PreviewSettings>) => void;
};
function EmptyState({ onCreate, onImport }: {
    onCreate: () => void;
    onImport: () => void;
}) {
    return (<div className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface-sunken/30 p-8 text-center">
      <Palette className="size-10 text-muted-foreground/50" strokeWidth={1.25} aria-hidden/>
      <div className="flex max-w-sm flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Sua biblioteca de materiais</h3>
        <p className="text-2xs leading-relaxed text-pretty text-muted-foreground">
          Monte materiais PBR a partir de um único albedo ou de conjuntos completos de mapas, defina densidade e atrito, e aplique a qualquer primitiva, modelo ou
          camada de terreno. Tudo fica salvo neste navegador.
        </p>
      </div>
      <div className="flex gap-2">
        <ActionButton icon={Plus} variant="primary" className="flex-none px-3" onClick={onCreate}>
          Novo material
        </ActionButton>
        <ActionButton icon={Images} className="flex-none px-3" onClick={onImport}>
          Importar imagens PBR…
        </ActionButton>
      </div>
    </div>);
}
export function MaterialEditorDialog({ open, onOpenChange, selectedId, onSelect, preview, onPreviewChange }: MaterialEditorDialogProps) {
    const session = useEditorState();
    const library = session.materials;
    const documents = library.all;
    const selected: MaterialDocument | null = (selectedId ? library.get(selectedId) : null) ?? documents[0] ?? null;
    const importInputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const importFiles = async (files: File[]) => {
        setBusy(true);
        try {
            const result = await importPbrFiles(session, files, selected);
            if (result.created.length > 0)
                onSelect(result.created[result.created.length - 1].id);
        }
        finally {
            setBusy(false);
        }
    };
    const drop = useFileDrop((files) => void importFiles(files));
    const createMaterial = () => onSelect(library.create().id);
    const duplicate = () => {
        if (selected)
            onSelect(library.duplicate(selected).id);
    };
    const remove = () => {
        if (!selected)
            return;
        const index = documents.indexOf(selected);
        const next = documents[index + 1] ?? documents[index - 1] ?? null;
        library.remove(selected);
        session.log.info('Materiais', `"${selected.name}" excluído da biblioteca.`);
        onSelect(next?.id ?? null);
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-busy={busy} {...drop.handlers} className={cn('flex h-[min(860px,calc(100dvh-2rem))] w-[min(1440px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-sm border border-border-strong bg-surface p-0 text-foreground shadow-2xl ring-0 sm:max-w-none', drop.active && 'outline-2 outline-offset-[-2px] outline-primary outline-dashed')}>
        <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Palette className="size-4 shrink-0 text-primary" aria-hidden/>
            <DialogTitle className="shrink-0 text-xs font-semibold">Editor de materiais</DialogTitle>
            <DialogDescription className="sr-only">Crie, edite e aplique materiais PBR da sua biblioteca.</DialogDescription>
          </div>
          {selected && (<div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="h-4 w-px bg-border" aria-hidden/>
              <FieldInput key={`${selected.id}-${selected.name}`} defaultValue={selected.name} aria-label="Nome do material" className="max-w-64 font-medium" onBlur={(event) => library.rename(selected, event.currentTarget.value)} onKeyDown={(event) => {
                if (event.key === 'Enter')
                    event.currentTarget.blur();
            }}/>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {library.status === 'ready' ? 'salvo automaticamente' : library.status === 'loading' ? 'carregando…' : 'sem persistência'}
              </span>
            </div>)}
          {!selected && <span className="flex-1"/>}
          {library.error && (<span className="max-w-72 truncate text-[10px] text-warning" title={library.error}>
              {library.error}
            </span>)}
          <input ref={importInputRef} type="file" accept={ACCEPTED_IMAGES} multiple className="sr-only" tabIndex={-1} aria-label="Imagens PBR para importar" onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            if (files.length > 0)
                void importFiles(files);
        }}/>
          <IconButton label="Fechar editor de materiais (Esc)" onClick={() => onOpenChange(false)}>
            <X />
          </IconButton>
        </header>

        <div className="flex min-h-0 flex-1">
          <MaterialLibraryList documents={documents} status={library.status} selectedId={selected?.id ?? null} onSelect={onSelect} onCreate={createMaterial} onImport={() => importInputRef.current?.click()}/>
          {selected ? (<>
              <MaterialPreview material={selected.material} settings={preview} onChange={onPreviewChange}/>
              <MaterialProperties document={selected} onDuplicate={duplicate} onRemove={remove}/>
            </>) : (<EmptyState onCreate={createMaterial} onImport={() => importInputRef.current?.click()}/>)}
        </div>
      </DialogContent>
    </Dialog>);
}
