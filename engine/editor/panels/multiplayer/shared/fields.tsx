'use client';
import { blurOnEnter } from '@/engine/editor/panels/input/shared/blur-on-enter';
import { FieldInput } from '@/engine/ui/field-input';
import { cn } from '@/lib/utils';
type NumberFieldProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    className?: string;
    onCommit: (value: number) => void;
};
type CommitFieldProps = {
    label: string;
    value: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    onCommit: (value: string) => void;
};
export function NumberField({ label, value, min, max, step = 1, disabled, className, onCommit }: NumberFieldProps) {
    return (<FieldInput key={value} type="number" aria-label={label} title={label} min={min} max={max} step={step} defaultValue={value} disabled={disabled} className={cn('w-20 flex-none', className)} onKeyDown={blurOnEnter} onBlur={(event) => {
            const next = Number(event.currentTarget.value);
            if (Number.isFinite(next) && next !== value)
                onCommit(next);
        }}/>);
}
export function CommitField({ label, value, placeholder, disabled, className, onCommit }: CommitFieldProps) {
    return (<FieldInput key={value} aria-label={label} title={label} defaultValue={value} placeholder={placeholder} disabled={disabled} spellCheck={false} className={className} onKeyDown={blurOnEnter} onBlur={(event) => {
            const next = event.currentTarget.value.trim();
            if (next !== value)
                onCommit(next);
        }}/>);
}
