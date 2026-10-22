import type { AnimationDocument } from '@/engine/core/animation/animation-document';
type Listener = () => void;
const documents = new Map<string, AnimationDocument>();
const listeners = new Set<Listener>();
let version = 0;
function notify(): void {
    version++;
    for (const listener of listeners)
        listener();
}
export function registerAnimationDocument(assetId: string, document: AnimationDocument): void {
    if (documents.get(assetId) === document)
        return;
    documents.set(assetId, document);
    notify();
}
export function unregisterAnimationDocument(assetId: string): void {
    if (documents.delete(assetId))
        notify();
}
export function getAnimationDocument(assetId: string): AnimationDocument | null {
    return documents.get(assetId) ?? null;
}
export function subscribeAnimationDocuments(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export function animationDocumentsVersion(): number {
    return version;
}
