'use client';
import { useRef, useState, type DragEvent } from 'react';
import { carriesAsset, readAssetDragData } from '@/engine/editor/library/asset-drag';
export type DropPayload = 'files' | 'asset';
export interface DropPoint {
    u: number;
    v: number;
}
type AssetDropHandler = (assetId: string, point: DropPoint) => void;
function carriesFiles(dataTransfer: DataTransfer): boolean {
    return Array.from(dataTransfer.types).includes('Files');
}
function payloadOf(event: DragEvent, acceptsAssets: boolean): DropPayload | null {
    if (carriesFiles(event.dataTransfer))
        return 'files';
    if (acceptsAssets && carriesAsset(event.dataTransfer))
        return 'asset';
    return null;
}
export function useFileDrop(onFiles: (files: File[]) => void, onAsset?: AssetDropHandler) {
    const [payload, setPayload] = useState<DropPayload | null>(null);
    const depth = useRef(0);
    const acceptsAssets = onAsset !== undefined;
    const handlers = {
        onDragEnter: (event: DragEvent) => {
            const current = payloadOf(event, acceptsAssets);
            if (!current)
                return;
            event.preventDefault();
            depth.current++;
            setPayload(current);
        },
        onDragOver: (event: DragEvent) => {
            if (!payloadOf(event, acceptsAssets))
                return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave: (event: DragEvent) => {
            if (!payloadOf(event, acceptsAssets))
                return;
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0)
                setPayload(null);
        },
        onDrop: (event: DragEvent) => {
            const current = payloadOf(event, acceptsAssets);
            if (!current)
                return;
            event.preventDefault();
            depth.current = 0;
            setPayload(null);
            if (current === 'files') {
                const files = Array.from(event.dataTransfer.files);
                if (files.length > 0)
                    onFiles(files);
                return;
            }
            const assetId = readAssetDragData(event.dataTransfer);
            if (!assetId || !onAsset)
                return;
            const bounds = event.currentTarget.getBoundingClientRect();
            onAsset(assetId, { u: (event.clientX - bounds.left) / bounds.width, v: (event.clientY - bounds.top) / bounds.height });
        },
    };
    return { active: payload !== null, payload, handlers };
}
