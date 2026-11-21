'use client';
import { blurOnEnter } from '@/engine/editor/panels/input/shared/blur-on-enter';
import { FieldInput } from '@/engine/ui/field-input';
const KEY_HINT = 'Chave usada nos scripts. Aceita letras, números, ".", "-", "_" e "/".';
type EntryKeyFieldProps = {
    entryKey: string;
    onRename: (name: string) => string | null;
    onRenamed?: (key: string) => void;
};
export function EntryKeyField({ entryKey, onRename, onRenamed }: EntryKeyFieldProps) {
    return (<FieldInput defaultValue={entryKey} title={KEY_HINT} aria-label={`Chave ${entryKey}`} spellCheck={false} onKeyDown={blurOnEnter} onBlur={(event) => {
            const renamed = onRename(event.currentTarget.value);
            if (renamed === null)
                event.currentTarget.value = entryKey;
            else
                onRenamed?.(renamed);
        }}/>);
}
