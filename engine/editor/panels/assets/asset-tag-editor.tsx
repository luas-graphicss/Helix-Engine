'use client';
import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { FieldInput } from '@/engine/ui/field-input';
type AssetTagEditorProps = {
    tags: readonly string[];
    onChange: (tags: string[]) => void;
};
export function AssetTagEditor({ tags, onChange }: AssetTagEditorProps) {
    const [draft, setDraft] = useState('');
    const commit = () => {
        const additions = draft.split(',').map((tag) => tag.trim()).filter(Boolean);
        if (additions.length > 0)
            onChange([...tags, ...additions]);
        setDraft('');
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();
        if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229)
            commit();
        else if (event.key === 'Backspace' && draft === '' && tags.length > 0)
            onChange(tags.slice(0, -1));
    };
    return (<div className="flex flex-col gap-1.5 px-2">
      {tags.length > 0 && (<ul className="flex flex-wrap gap-1" aria-label="Etiquetas">
          {tags.map((tag) => (<li key={tag} className="flex h-5 items-center gap-1 rounded-sm bg-surface-raised pr-0.5 pl-1.5 font-mono text-[10px] text-foreground">
              {tag}
              <button type="button" aria-label={`Remover etiqueta ${tag}`} onClick={() => onChange(tags.filter((candidate) => candidate !== tag))} className="flex size-4 items-center justify-center rounded-[2px] text-muted-foreground hover:bg-highlight hover:text-foreground">
                <X className="size-3" aria-hidden/>
              </button>
            </li>))}
        </ul>)}
      <FieldInput aria-label="Nova etiqueta" placeholder="Adicionar etiquetas, separadas por vírgula" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} onKeyDown={onKeyDown} onBlur={commit}/>
    </div>);
}
