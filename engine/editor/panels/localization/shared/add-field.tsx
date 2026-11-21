'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
const IME_KEY_CODE = 229;
type AddFieldProps = {
    label: string;
    placeholder: string;
    validate: (value: string) => string | null;
    onAdd: (value: string) => void;
    stacked?: boolean;
};
export function AddField({ label, placeholder, validate, onAdd, stacked = false }: AddFieldProps) {
    const [value, setValue] = useState('');
    const [problem, setProblem] = useState<string | null>(null);
    const submit = (): void => {
        const found = validate(value);
        setProblem(found);
        if (found !== null)
            return;
        onAdd(value.trim());
        setValue('');
    };
    return (<form className={cn('flex min-w-0 flex-1 items-center gap-1', stacked && 'flex-wrap')} onSubmit={(event) => {
            event.preventDefault();
            submit();
        }}>
      <FieldInput value={value} placeholder={placeholder} aria-label={label} aria-invalid={problem !== null || undefined} spellCheck={false} className={cn(problem !== null && 'border-destructive/70')} onChange={(event) => {
            setValue(event.currentTarget.value);
            setProblem(null);
        }} onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === IME_KEY_CODE))
                event.preventDefault();
        }}/>
      <IconButton type="submit" label={label} size="sm" disabled={value.trim() === ''}>
        <Plus />
      </IconButton>
      {problem !== null && (<span role="alert" title={problem} className={cn('min-w-0 text-3xs text-destructive', stacked ? 'basis-full text-pretty' : 'truncate')}>
          {problem}
        </span>)}
    </form>);
}
