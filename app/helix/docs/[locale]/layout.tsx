import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsShell } from '@/docs/components/docs-shell';
import { loadAllSections } from '@/docs/content/docs-content';
import { DOCS_LOCALES, isDocsLocale } from '@/docs/docs-locale';
import '@/docs/docs.css';
export const metadata: Metadata = {
    title: {
        default: 'Documentação',
        template: '%s · Documentação · Helix Engine',
    },
    description: 'Documentação da Helix Engine: manual, tutoriais e referência da API de scripting.',
};
export function generateStaticParams() {
    return DOCS_LOCALES.map((locale) => ({ locale }));
}
export default async function DocsLayout({ children, params }: {
    children: React.ReactNode;
    params: Promise<{
        locale: string;
    }>;
}) {
    const { locale } = await params;
    if (!isDocsLocale(locale))
        notFound();
    const sections = await loadAllSections(locale);
    return (<DocsShell locale={locale} sections={sections}>
      {children}
    </DocsShell>);
}
