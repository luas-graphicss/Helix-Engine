'use client';
import { createContext, useContext } from 'react';
import type { Vec3 } from '@/engine/core/math/vec3';
export type PickColor = () => Promise<Vec3 | null>;
const ColorPickerContext = createContext<PickColor | null>(null);
export const ColorPickerProvider = ColorPickerContext.Provider;
export function useColorPicker(): PickColor | null {
    return useContext(ColorPickerContext);
}
