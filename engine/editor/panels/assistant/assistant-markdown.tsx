'use client';
import type { ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
const REMARK_PLUGINS = [remarkGfm];
const BLOCKED_ELEMENTS = ['img'];
const INLINE_CODE_CLASS = 'rounded-xs bg-surface-sunken px-1 text-[0.92em]';
function Heading({ children }: {
    children?: ReactNode;
}) {
    return <h4 className="mt-2 mb-1 font-semibold text-foreground first:mt-0">{children}</h4>;
}
const COMPONENTS: Components = {
    h1: Heading,
    h2: Heading,
    h3: Heading,
    h4: Heading,
    p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="my-1 list-disc pl-4">{children}</ul>,
    ol: ({ children }) => <ol className="my-1 list-decimal pl-4">{children}</ol>,
    a: ({ href, children }) => (<a href={href} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2 hover:text-foreground">
        {children}
      </a>),
    pre: ({ children }) => <pre className="my-1.5 overflow-x-auto rounded-sm border border-border bg-surface-sunken p-2 text-2xs leading-relaxed [&>code]:bg-transparent [&>code]:p-0">{children}</pre>,
    code: ({ className, children }) => <code className={cn('font-mono', className ?? INLINE_CODE_CLASS)}>{children}</code>,
    blockquote: ({ children }) => <blockquote className="my-1 border-l border-border-strong pl-2 text-muted-foreground">{children}</blockquote>,
    table: ({ children }) => (<div className="my-1.5 overflow-x-auto">
        <table className="w-full border-collapse text-2xs">{children}</table>
      </div>),
    th: ({ children }) => <th className="border border-border px-1.5 py-0.5 text-left font-semibold">{children}</th>,
    td: ({ children }) => <td className="border border-border px-1.5 py-0.5">{children}</td>,
};
type AssistantMarkdownProps = {
    text: string;
    className?: string;
};
export function AssistantMarkdown({ text, className }: AssistantMarkdownProps) {
    return (<div className={cn('min-w-0 text-xs leading-relaxed break-words text-foreground/90', className)}>
      <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS} disallowedElements={BLOCKED_ELEMENTS}>
        {text}
      </Markdown>
    </div>);
}
