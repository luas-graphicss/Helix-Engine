import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Info, Lightbulb, MessageSquareWarning, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Components, ExtraProps } from 'react-markdown';
import { CopyCodeButton } from '../components/copy-code-button';
import { SlugCounter } from '../content/markdown-outline';
import { DocsFigure } from './docs-figure';
import type { CalloutKind } from './remark-callouts';
import { CODE_LANGUAGE_LABEL } from './highlighter';
import { codeLanguageOf, hastText, isSoleImageParagraph } from './hast-text';
type HeadingProps = ComponentPropsWithoutRef<'h2'> & ExtraProps;
const CALLOUT_META: Record<CalloutKind, {
    title: string;
    icon: LucideIcon;
}> = {
    note: { title: 'Nota', icon: Info },
    tip: { title: 'Dica', icon: Lightbulb },
    important: { title: 'Importante', icon: MessageSquareWarning },
    warning: { title: 'Atenção', icon: TriangleAlert },
    caution: { title: 'Cuidado', icon: OctagonAlert },
};
const MODIFIER_KEYS = new Set(['ctrl', 'shift', 'alt', 'cmd', 'meta']);
const SINGLE_KEYS = new Set(['delete', 'backspace', 'escape', 'esc', 'enter', 'espaço', 'space', 'tab', 'home', 'end', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12']);
function keyChordParts(text: string): string[] | null {
    const parts = text.split('+').map((part) => part.trim());
    if (parts.some((part) => part.length === 0))
        return null;
    const first = parts[0].toLowerCase();
    if (parts.length > 1 && MODIFIER_KEYS.has(first))
        return parts;
    if (parts.length === 1 && SINGLE_KEYS.has(first))
        return parts;
    return null;
}
function KeyChord({ parts }: {
    parts: string[];
}) {
    return (<span className="docs-kbd-group">
      {parts.map((part, index) => (<kbd key={`${part}-${index}`} className="docs-kbd">
          {part}
        </kbd>))}
    </span>);
}
function isExternalHref(href: string): boolean {
    return /^(https?:)?\/\//.test(href) || href.startsWith('mailto:');
}
export function createMarkdownComponents(slugs: SlugCounter): Components {
    function heading(level: 2 | 3) {
        const Tag = `h${level}` as const;
        return function Heading({ node, children, ...props }: HeadingProps) {
            const id = slugs.next(hastText(node));
            return (<Tag id={id} className="docs-heading group scroll-mt-24" {...props}>
          <a href={`#${id}`} className="docs-heading-anchor" aria-label="Link para esta seção">
            #
          </a>
          {children}
        </Tag>);
        };
    }
    return {
        h1: ({ node: _node, ...props }) => <h2 {...props}/>,
        h2: heading(2),
        h3: heading(3),
        a: ({ node: _node, href = '', children, ...props }) => {
            if (isExternalHref(href)) {
                return (<a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
            <ArrowUpRight className="docs-external-icon" aria-hidden/>
          </a>);
            }
            return (<Link href={href} {...props}>
          {children}
        </Link>);
        },
        pre: ({ node, children, ...props }) => {
            const language = codeLanguageOf(node) ?? 'text';
            return (<figure className="docs-code">
          <figcaption className="docs-code-header">
            <span className="docs-code-language">{CODE_LANGUAGE_LABEL[language] ?? language}</span>
            <CopyCodeButton code={hastText(node).replace(/\n$/, '')}/>
          </figcaption>
          <pre {...props}>{children}</pre>
        </figure>);
        },
        code: ({ node: _node, className, children, ...props }) => {
            const isBlock = typeof className === 'string' && className.includes('language-');
            if (!isBlock && typeof children === 'string') {
                const parts = keyChordParts(children);
                if (parts)
                    return <KeyChord parts={parts}/>;
            }
            return (<code className={className} {...props}>
          {children}
        </code>);
        },
        table: ({ node: _node, children, ...props }) => (<div className="docs-table-wrap">
        <table {...props}>{children}</table>
      </div>),
        aside: ({ node, children, ...props }) => {
            const kind = (node?.properties['data-callout'] as CalloutKind | undefined) ?? 'note';
            const meta = CALLOUT_META[kind];
            const title = (node?.properties['data-title'] as string | undefined) ?? meta.title;
            const Icon = meta.icon;
            const { 'data-callout': _kind, 'data-title': _title, ...rest } = props as Record<string, unknown>;
            return (<aside className="docs-callout" data-callout={kind} {...rest}>
          <div className="docs-callout-title">
            <Icon className="size-4" aria-hidden/>
            <span>{title}</span>
          </div>
          <div className="docs-callout-body">{children as ReactNode}</div>
        </aside>);
        },
        p: ({ node, children, ...props }) => (isSoleImageParagraph(node) ? <>{children}</> : <p {...props}>{children}</p>),
        img: ({ node: _node, src, alt = '', title }) => (typeof src === 'string' ? <DocsFigure src={src} alt={alt} caption={title}/> : null),
    };
}
