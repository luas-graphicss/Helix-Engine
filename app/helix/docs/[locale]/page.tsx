import { notFound } from 'next/navigation';
import { DocsHome } from '@/docs/components/docs-home';
import { loadAllSections } from '@/docs/content/docs-content';
import { isDocsLocale } from '@/docs/docs-locale';
export default async function DocsHomePage({ params }: {
    params: Promise<{
        locale: string;
    }>;
}) {
    const { locale } = await params;
    if (!isDocsLocale(locale))
        notFound();
    return <DocsHome locale={locale} sections={await loadAllSections(locale)}/>;
}
