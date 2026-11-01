'use client';
import type { ReactNode } from 'react';
import { GuiNumberField, type GuiNumberFieldProps } from '@/engine/editor/panels/gui/inspector/fields/gui-number-field';
import { PropertyRow } from '@/engine/ui/property-row';
type NumberRowProps = Omit<GuiNumberFieldProps, 'className'> & {
    trailing?: ReactNode;
};
export function NumberRow({ label, trailing, ...props }: NumberRowProps) {
    return (<PropertyRow label={label}>
      <GuiNumberField label={label} {...props}/>
      {trailing}
    </PropertyRow>);
}
export function Hint({ children }: {
    children: ReactNode;
}) {
    return <p className="px-2 py-0.5 text-3xs leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
