'use client';
import { useCallback, useEffect, useState } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { importPbrFiles } from '@/engine/editor/operations/material-library-operations';
import { MaterialEditorDialog } from './material-editor-dialog';
import { subscribeMaterialEditorRequests } from './material-editor-requests';
import { createPreviewSettings, type PreviewSettings } from './preview/preview-settings';
export function MaterialEditorHost() {
    const session = useEditorSession();
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [preview, setPreview] = useState<PreviewSettings>(() => createPreviewSettings());
    useEffect(() => subscribeMaterialEditorRequests((request) => {
        if (request.materialId)
            setSelectedId(request.materialId);
        setOpen(true);
        if (request.files && request.files.length > 0) {
            const target = request.materialId ? session.materials.get(request.materialId) : null;
            void importPbrFiles(session, request.files, target).then((result) => {
                if (result.created.length > 0)
                    setSelectedId(result.created[result.created.length - 1].id);
            });
        }
    }), [session]);
    const onPreviewChange = useCallback((patch: Partial<PreviewSettings>) => setPreview((current) => ({ ...current, ...patch })), []);
    return <MaterialEditorDialog open={open} onOpenChange={setOpen} selectedId={selectedId} onSelect={setSelectedId} preview={preview} onPreviewChange={onPreviewChange}/>;
}
