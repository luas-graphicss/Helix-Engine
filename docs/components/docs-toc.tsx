'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { OutlineEntry } from '../content/markdown-outline';
export function DocsToc({ outline }: {
    outline: readonly OutlineEntry[];
}) {
    const [activeId, setActiveId] = useState<string | null>(outline[0]?.id ?? null);
    useEffect(() => {
        if (outline.length === 0)
            return;
        const headings = outline.map((entry) => document.getElementById(entry.id)).filter((element): element is HTMLElement => element !== null);
        if (headings.length === 0)
            return;
        const update = () => {
            const threshold = window.innerHeight * 0.3;
            let current = headings[0];
            for (const heading of headings) {
                if (heading.getBoundingClientRect().top - threshold <= 0)
                    current = heading;
                else
                    break;
            }
            setActiveId(current.id);
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [outline]);
    if (outline.length === 0)
        return null;
    return (<nav aria-label="Nesta página" className="flex flex-col gap-3">
      <p className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">Nesta página</p>
      <ul className="flex flex-col border-l border-border-strong">
        {outline.map((entry) => {
            const isActive = entry.id === activeId;
            return (<li key={entry.id}>
              <a href={`#${entry.id}`} className={cn('-ml-px block border-l py-1 pr-2 text-[0.8125rem] leading-snug transition-colors focus-visible:outline-1 focus-visible:outline-primary', entry.level === 3 ? 'pl-7' : 'pl-4', isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {entry.text}
              </a>
            </li>);
        })}
      </ul>
    </nav>);
}
