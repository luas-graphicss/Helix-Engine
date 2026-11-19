import type { ReactNode } from 'react';
type InspectorHeaderProps = {
    title: string;
    description: string;
    children?: ReactNode;
};
export function InspectorHeader({ title, description, children }: InspectorHeaderProps) {
    return (<header className="flex flex-col gap-0.5 px-2 pb-1">
      <div className="flex items-center gap-0.5">
        <h3 className="min-w-0 flex-1 truncate text-2xs font-medium text-foreground">{title}</h3>
        {children}
      </div>
      <p className="text-3xs leading-relaxed text-pretty text-muted-foreground">{description}</p>
    </header>);
}
