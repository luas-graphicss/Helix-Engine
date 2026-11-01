'use client';
import { useLayoutEffect, useState, type RefObject } from 'react';
export interface ElementSize {
    readonly width: number;
    readonly height: number;
}
const UNMEASURED: ElementSize = { width: 0, height: 0 };
export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>): ElementSize {
    const [size, setSize] = useState<ElementSize>(UNMEASURED);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element)
            return;
        const measure = () => {
            const rect = element.getBoundingClientRect();
            setSize((current) => (current.width === rect.width && current.height === rect.height ? current : { width: rect.width, height: rect.height }));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);
    return size;
}
