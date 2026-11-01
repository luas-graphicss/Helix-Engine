import { NextResponse } from 'next/server';
import { buildSearchIndex } from '@/docs/content/docs-content';
import { DOCS_LOCALES, isDocsLocale } from '@/docs/docs-locale';
export function generateStaticParams() {
    return DOCS_LOCALES.map((locale) => ({ locale }));
}
export async function GET(_request: Request, { params }: {
    params: Promise<{
        locale: string;
    }>;
}) {
    const { locale } = await params;
    if (!isDocsLocale(locale))
        return NextResponse.json({ error: 'Idioma desconhecido.' }, { status: 404 });
    return NextResponse.json(await buildSearchIndex(locale), {
        headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
}
