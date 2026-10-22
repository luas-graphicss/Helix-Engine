export interface MaterialEditorRequest {
    materialId?: string;
    files?: File[];
}
type MaterialEditorListener = (request: MaterialEditorRequest) => void;
let listener: MaterialEditorListener | null = null;
export function openMaterialEditor(request: MaterialEditorRequest = {}): void {
    listener?.(request);
}
export function subscribeMaterialEditorRequests(next: MaterialEditorListener): () => void {
    listener = next;
    return () => {
        if (listener === next)
            listener = null;
    };
}
