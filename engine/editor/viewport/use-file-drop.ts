'use client';
import { useRef, useState, type DragEvent } from 'react';
function carriesFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer.types).includes('Files');
}
export function useFileDrop(onFiles: (files: File[]) => void) {
    const [active, setActive] = useState(false);
    const depth = useRef(0);
    const handlers = {
        onDragEnter: (event: DragEvent) => {
            if (!carriesFiles(event))
                return;
            event.preventDefault();
            depth.current++;
            setActive(true);
        },
        onDragOver: (event: DragEvent) => {
            if (!carriesFiles(event))
                return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave: (event: DragEvent) => {
            if (!carriesFiles(event))
                return;
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0)
                setActive(false);
        },
        onDrop: (event: DragEvent) => {
            if (!carriesFiles(event))
                return;
            event.preventDefault();
            depth.current = 0;
            setActive(false);
            const files = Array.from(event.dataTransfer.files);
            if (files.length > 0)
                onFiles(files);
        },
    };
    return { active, handlers };
}
