import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
import { createGenericIntelligence } from './generic-intelligence';
import { NO_INTELLIGENCE, type LanguageIntelligence } from './language-intelligence';
export interface IntelligenceHost {
    readonly session: EditorSession;
    readonly assetId: string;
    readonly language: ScriptLanguageId;
    scriptName(): string;
}
type IntelligenceFactory = (host: IntelligenceHost) => Promise<LanguageIntelligence>;
const FACTORIES: Partial<Record<ScriptLanguageId, IntelligenceFactory>> = {
    typescript: async (host) => (await import('./typescript-intelligence')).createTypeScriptIntelligence(host),
    javascript: async (host) => (await import('./typescript-intelligence')).createTypeScriptIntelligence(host),
};
export function createIntelligence(host: IntelligenceHost): Promise<LanguageIntelligence> {
    const factory = FACTORIES[host.language];
    if (!factory)
        return Promise.resolve(createGenericIntelligence(host));
    return factory(host).catch((cause: unknown) => {
        console.warn(`[helix] inteligência de ${host.language} indisponível:`, cause);
        return NO_INTELLIGENCE;
    });
}
