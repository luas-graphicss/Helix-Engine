'use client';
import { useMemo, type ReactNode } from 'react';
import * as vec3 from '@/engine/core/math/vec3';
import { hexToLinearRgb } from '@/engine/core/color/srgb';
import { ColorPickerProvider, type PickColor } from '@/engine/ui/color-picker-context';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
interface EyeDropperResult {
    sRGBHex: string;
}
interface EyeDropperApi {
    open(options?: {
        signal?: AbortSignal;
    }): Promise<EyeDropperResult>;
}
declare global {
    interface Window {
        EyeDropper?: new () => EyeDropperApi;
    }
}
export function ViewportColorPickerProvider({ children }: {
    children: ReactNode;
}) {
    const session = useEditorSession();
    const pick = useMemo<PickColor>(() => async () => {
        const EyeDropper = window.EyeDropper;
        if (!EyeDropper)
            return session.colorPicker.begin();
        try {
            const result = await new EyeDropper().open();
            return hexToLinearRgb(vec3.create(), result.sRGBHex);
        }
        catch {
            return null;
        }
    }, [session]);
    return <ColorPickerProvider value={pick}>{children}</ColorPickerProvider>;
}
