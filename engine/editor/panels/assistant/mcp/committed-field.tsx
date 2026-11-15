'use client';
import { useState, type ComponentProps } from 'react';
import { FieldInput } from '@/engine/ui/field-input';
type CommittedFieldProps = Omit<ComponentProps<typeof FieldInput>, 'value' | 'onChange' | 'onBlur' | 'onKeyDown'> & {
    value: string;
    onCommit: (value: string) => void;
};
export function CommittedField({ value, onCommit, ...props }: CommittedFieldProps) {
    const [draft, setDraft] = useState<string | null>(null);
    const commit = () => {
        if (draft !== null && draft !== value)
            onCommit(draft);
        setDraft(null);
    };
    return (<FieldInput {...props} value={draft ?? value} onChange={(event) => setDraft(event.currentTarget.value)} onBlur={commit} onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229)
                return;
            event.currentTarget.blur();
        }}/>);
}
