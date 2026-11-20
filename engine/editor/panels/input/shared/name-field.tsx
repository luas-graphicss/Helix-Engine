'use client';
import { blurOnEnter } from './blur-on-enter';
type NameFieldProps = {
    name: string;
    label: string;
    onCommit: (name: string) => void;
    onDone: () => void;
};
export function NameField({ name, label, onCommit, onDone }: NameFieldProps) {
    return (<div className="flex h-control items-center px-2">
      <input autoFocus defaultValue={name} aria-label={label} onFocus={(event) => event.currentTarget.select()} onBlur={(event) => {
            onCommit(event.currentTarget.value);
            onDone();
        }} onKeyDown={(event) => {
            event.stopPropagation();
            blurOnEnter(event);
            if (event.key === 'Escape') {
                event.currentTarget.value = name;
                event.currentTarget.blur();
            }
        }} className="h-5 min-w-0 flex-1 rounded-xs border border-primary/70 bg-input px-1 text-2xs text-foreground shadow-well outline-none"/>
    </div>);
}
