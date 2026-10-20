'use client';
import { useState, type ReactNode } from 'react';
import { SectionHeader } from './section-header';
type CollapsibleSectionProps = {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
    trailing?: ReactNode;
};
export function CollapsibleSection({ title, children, defaultOpen = true, trailing }: CollapsibleSectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (<div>
      <SectionHeader title={title} open={open} onToggle={() => setOpen((value) => !value)} trailing={trailing}/>
      {open && <div className="flex flex-col gap-0.5 py-1.5">{children}</div>}
    </div>);
}
