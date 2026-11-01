import { CodeTabLoader } from '@/engine/editor/code/code-tab-loader';
export default async function CodeTabPage({ params, searchParams }: {
    params: Promise<{
        projectId: string;
    }>;
    searchParams: Promise<{
        script?: string | string[];
    }>;
}) {
    const [{ projectId }, query] = await Promise.all([params, searchParams]);
    const script = Array.isArray(query.script) ? query.script[0] : query.script;
    return <CodeTabLoader projectId={projectId} initialScriptId={script ?? null}/>;
}
