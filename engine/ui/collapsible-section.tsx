'use client';
import { useState, type ReactNode } from 'react';
import { SectionHeader } from './section-header';
type CollapsibleSectionProps = {
    title: string;
    hint?: string;
    children: ReactNode;
    defaultOpen?: boolean;
    trailing?: ReactNode;
};
export function CollapsibleSection({ title, hint, children, defaultOpen = true, trailing }: CollapsibleSectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (<div>
      <SectionHeader title={title} hint={hint} open={open} onToggle={() => setOpen((value) => !value)} trailing={trailing}/>
      {open && <div className="flex flex-col gap-px py-1">{children}</div>}
    </div>);
}
