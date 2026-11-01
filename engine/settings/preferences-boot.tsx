'use client';
import { useEffect } from 'react';
import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
import { betaFeatures } from './beta-features';
import { UI_SCALE_BASE_PX, uiScaleRootFontPx } from './engine-settings-schema';
import { engineSettings } from './engine-settings-store';
import { useEngineSetting } from './engine-settings-store';
const REDUCE_MOTION_ATTRIBUTE = 'data-reduce-motion';
const UI_SCALE_ATTRIBUTE = 'data-ui-scale';
export function PreferencesBoot() {
    const reduceMotion = useEngineSetting('editor.ui.reduceMotion');
    const uiScale = useEngineSetting('editor.ui.scale');
    useEffect(() => {
        void engineSettings.load();
        void shortcutBindings.load();
        void betaFeatures.load();
    }, []);
    useEffect(() => {
        const root = document.documentElement;
        if (reduceMotion)
            root.setAttribute(REDUCE_MOTION_ATTRIBUTE, '');
        else
            root.removeAttribute(REDUCE_MOTION_ATTRIBUTE);
    }, [reduceMotion]);
    useEffect(() => {
        const root = document.documentElement;
        const fontPx = uiScaleRootFontPx(uiScale);
        root.style.fontSize = fontPx === UI_SCALE_BASE_PX ? '' : `${fontPx}px`;
        root.setAttribute(UI_SCALE_ATTRIBUTE, uiScale);
    }, [uiScale]);
    return null;
}
