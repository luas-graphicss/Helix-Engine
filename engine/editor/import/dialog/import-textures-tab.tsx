'use client';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FolderSearch, FilePlus2, Link2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ImportedTexture } from '@/engine/assets/import/import-types';
import { FieldInput } from '@/engine/ui/field-input';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
import { textureStatus, type ImportDraft, type TextureStatus } from '../use-import-draft';
import { computeTextureUsages, formatBytes, type TextureUsage } from './import-format';
import { StatusBadge } from './status-badge';
const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp';
const STATUS_LABEL: Record<TextureStatus, {
    label: string;
    tone: 'neutral' | 'primary' | 'warning';
}> = {
    embedded: { label: 'embutida', tone: 'neutral' },
    file: { label: 'arquivo', tone: 'primary' },
    missing: { label: 'ausente', tone: 'warning' },
};
type ImportTexturesTabProps = {
    draft: ImportDraft;
    notice: string | null;
    onDismissNotice: () => void;
    onCompanionFiles: (files: File[]) => void;
};
function TexturePathField({ texture, onCommit }: {
    texture: ImportedTexture;
    onCommit: (path: string) => boolean;
}) {
    const [text, setText] = useState(texture.sourcePath);
    const [feedback, setFeedback] = useState<'found' | 'not-found' | null>(null);
    useEffect(() => {
        setText(texture.sourcePath);
        setFeedback(null);
    }, [texture, texture.sourcePath]);
    const commit = () => {
        const next = text.trim();
        if (next === '' || next === texture.sourcePath) {
            setText(texture.sourcePath);
            return;
        }
        setFeedback(onCommit(next) ? 'found' : 'not-found');
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter')
            event.currentTarget.blur();
        else if (event.key === 'Escape') {
            setText(texture.sourcePath);
            event.currentTarget.blur();
        }
    };
    return (<div className="flex min-w-0 flex-col gap-0.5">
      <FieldInput aria-label={`Caminho de ${texture.name}`} value={text} onChange={(event) => setText(event.currentTarget.value)} onBlur={commit} onKeyDown={onKeyDown} spellCheck={false}/>
      {feedback === 'not-found' && <span className="text-[10px] text-warning">Nenhum arquivo com esse nome entre os adicionados.</span>}
      {feedback === 'found' && <span className="text-[10px] text-primary">Arquivo encontrado e vinculado.</span>}
    </div>);
}
function TextureRow({ texture, index, usages, draft, onPickFile }: {
    texture: ImportedTexture;
    index: number;
    usages: TextureUsage[];
    draft: ImportDraft;
    onPickFile: () => void;
}) {
    const status = textureStatus(texture);
    const badge = STATUS_LABEL[status];
    return (<li className={cn('grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 border-b border-border/60 px-2 py-2', status === 'missing' && 'bg-warning/5')}>
      <span className="row-span-3 size-10 overflow-hidden rounded-sm border border-border bg-surface-sunken">
        <ImageBlobThumbnail blob={texture.data} alt={`Miniatura de ${texture.name}`}/>
      </span>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-2xs text-foreground">{texture.name}</span>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        {texture.data && <span className="font-mono text-[10px] text-muted-foreground">{formatBytes(texture.data.size)}</span>}
      </div>
      <p className="truncate text-[10px] text-muted-foreground">
        {usages.length === 0 ? 'Não referenciada por nenhum material' : usages.map((usage) => `${usage.material} · ${usage.slot}`).join(', ')}
      </p>
      <div className="flex min-w-0 items-start gap-1">
        <TexturePathField texture={texture} onCommit={(path) => draft.setTexturePath(index, path)}/>
        <Button type="button" size="xs" variant={status === 'missing' ? 'outline' : 'ghost'} onClick={onPickFile} aria-label={`Escolher arquivo para ${texture.name}`}>
          <Link2 aria-hidden/>
          Arquivo…
        </Button>
      </div>
    </li>);
}
export function ImportTexturesTab({ draft, notice, onDismissNotice, onCompanionFiles }: ImportTexturesTabProps) {
    const { scene } = draft;
    const usages = useMemo(() => computeTextureUsages(scene), [scene, draft.revision]);
    const singleInputRef = useRef<HTMLInputElement>(null);
    const filesInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const pendingIndex = useRef<number | null>(null);
    useEffect(() => {
        folderInputRef.current?.setAttribute('webkitdirectory', '');
    }, []);
    const missing = scene.textures.filter((texture) => !texture.data).length;
    const sorted = useMemo(() => scene.textures.map((texture, index) => ({ texture, index })).sort((a, b) => Number(Boolean(a.texture.data)) - Number(Boolean(b.texture.data))), [scene, draft.revision]);
    if (scene.textures.length === 0) {
        return <p className="p-4 text-center text-2xs text-muted-foreground">O arquivo não referencia texturas.</p>;
    }
    return (<div className="flex flex-col">
      <div className="sticky top-0 z-10 flex flex-col gap-1.5 border-b border-border bg-surface px-2 py-2">
        <div className="flex items-center gap-1.5">
          <Button type="button" size="xs" variant="outline" onClick={() => filesInputRef.current?.click()}>
            <FilePlus2 aria-hidden/>
            Adicionar arquivos…
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={() => folderInputRef.current?.click()}>
            <FolderSearch aria-hidden/>
            Procurar pasta…
          </Button>
        </div>
        <p className="text-[10px] leading-4 text-muted-foreground">
          {missing > 0
            ? `${missing} ${missing === 1 ? 'textura ausente' : 'texturas ausentes'}. Adicione os arquivos (ou arraste-os para esta janela) para vinculá-los pelo nome.`
            : 'Todas as texturas foram resolvidas. Você ainda pode substituir qualquer uma por outro arquivo.'}
        </p>
        {notice && (<div className="flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] text-foreground">
            <span className="min-w-0 flex-1">{notice}</span>
            <button type="button" onClick={onDismissNotice} aria-label="Fechar aviso" className="text-muted-foreground hover:text-foreground">
              <X className="size-3" aria-hidden/>
            </button>
          </div>)}
      </div>

      <ul className="flex flex-col" aria-label="Texturas do arquivo">
        {sorted.map(({ texture, index }) => (<TextureRow key={index} texture={texture} index={index} usages={usages[index] ?? []} draft={draft} onPickFile={() => {
                pendingIndex.current = index;
                singleInputRef.current?.click();
            }}/>))}
      </ul>

      <input ref={singleInputRef} type="file" accept={ACCEPTED_IMAGES} className="hidden" tabIndex={-1} aria-hidden onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            const index = pendingIndex.current;
            event.currentTarget.value = '';
            pendingIndex.current = null;
            if (file && index !== null)
                draft.bindTextureFile(index, file);
        }}/>
      <input ref={filesInputRef} type="file" multiple accept={ACCEPTED_IMAGES} className="hidden" tabIndex={-1} aria-hidden onChange={(event) => {
            const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
            event.currentTarget.value = '';
            if (files.length > 0)
                onCompanionFiles(files);
        }}/>
      <input ref={folderInputRef} type="file" multiple className="hidden" tabIndex={-1} aria-hidden onChange={(event) => {
            const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
            event.currentTarget.value = '';
            if (files.length > 0)
                onCompanionFiles(files);
        }}/>
    </div>);
}
