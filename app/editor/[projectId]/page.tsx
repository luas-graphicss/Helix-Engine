import { EditorLoader } from '@/engine/editor/editor-loader';
export default async function EditorPage({ params }: {
    params: Promise<{
        projectId: string;
    }>;
}) {
    const { projectId } = await params;
    return <EditorLoader projectId={projectId}/>;
}
