import 'server-only';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { MarkdownAsync } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ShikiTransformer } from 'shiki/core';
import { SlugCounter } from '../content/markdown-outline';
import { HELIX_CODE_THEME_NAME } from './helix-code-theme';
import { getDocsHighlighter } from './highlighter';
import { createMarkdownComponents } from './markdown-components';
import { remarkCallouts } from './remark-callouts';
const stripPreAttributes: ShikiTransformer = {
    pre(node) {
        node.properties.style = undefined;
        node.properties.tabindex = undefined;
    },
};
export async function MarkdownArticle({ body }: {
    body: string;
}) {
    const highlighter = await getDocsHighlighter();
    return (<MarkdownAsync remarkPlugins={[remarkGfm, remarkCallouts]} rehypePlugins={[
            [
                rehypeShikiFromHighlighter,
                highlighter,
                {
                    theme: HELIX_CODE_THEME_NAME,
                    addLanguageClass: true,
                    defaultLanguage: 'text',
                    fallbackLanguage: 'text',
                    transformers: [stripPreAttributes],
                },
            ],
        ]} components={createMarkdownComponents(new SlugCounter())}>
      {body}
    </MarkdownAsync>);
}
