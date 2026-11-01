'use client';
import { useCallback, useState } from 'react';
import { planBaseLanguageChange, setBaseLanguage, type BaseLanguageChangePlan } from '@/engine/editor/operations/script-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
export interface BaseLanguageChange {
    readonly pending: BaseLanguageChangePlan | null;
    request(language: ScriptLanguageId): void;
    confirm(): void;
    cancel(): void;
}
export function useBaseLanguageChange(session: EditorSession, onApplied?: () => void): BaseLanguageChange {
    const [pending, setPending] = useState<BaseLanguageChangePlan | null>(null);
    const request = useCallback((language: ScriptLanguageId) => {
        if (session.scene.scripting.baseLanguage === language)
            return;
        const plan = planBaseLanguageChange(session, language);
        if (plan.affected.length > 0) {
            setPending(plan);
            return;
        }
        setBaseLanguage(session, language);
        onApplied?.();
    }, [session, onApplied]);
    const confirm = useCallback(() => {
        if (!pending)
            return;
        setBaseLanguage(session, pending.to);
        setPending(null);
        onApplied?.();
    }, [session, pending, onApplied]);
    const cancel = useCallback(() => setPending(null), []);
    return { pending, request, confirm, cancel };
}
