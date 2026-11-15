import type { ProtocolId } from './chat-protocol';
export interface ProviderPreset {
    readonly id: string;
    readonly label: string;
    readonly protocol: ProtocolId;
    readonly baseUrl: string;
    readonly keyRequired: boolean;
}
export const CUSTOM_PROVIDER_ID = 'custom';
export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
    { id: 'anthropic', label: 'Anthropic (Claude)', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', keyRequired: true },
    { id: 'openai', label: 'OpenAI (GPT)', protocol: 'openai-chat', baseUrl: 'https://api.openai.com/v1', keyRequired: true },
    { id: 'openai-codex', label: 'OpenAI Codex (Responses)', protocol: 'openai-responses', baseUrl: 'https://api.openai.com/v1', keyRequired: true },
    { id: 'openrouter', label: 'OpenRouter', protocol: 'openai-chat', baseUrl: 'https://openrouter.ai/api/v1', keyRequired: true },
    { id: 'google', label: 'Google Gemini', protocol: 'openai-chat', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyRequired: true },
    { id: 'xai', label: 'xAI (Grok)', protocol: 'openai-chat', baseUrl: 'https://api.x.ai/v1', keyRequired: true },
    { id: 'groq', label: 'Groq', protocol: 'openai-chat', baseUrl: 'https://api.groq.com/openai/v1', keyRequired: true },
    { id: 'mistral', label: 'Mistral', protocol: 'openai-chat', baseUrl: 'https://api.mistral.ai/v1', keyRequired: true },
    { id: 'deepseek', label: 'DeepSeek', protocol: 'openai-chat', baseUrl: 'https://api.deepseek.com/v1', keyRequired: true },
    { id: 'ollama', label: 'Ollama (local)', protocol: 'openai-chat', baseUrl: 'http://localhost:11434/v1', keyRequired: false },
    { id: 'lmstudio', label: 'LM Studio (local)', protocol: 'openai-chat', baseUrl: 'http://localhost:1234/v1', keyRequired: false },
    { id: CUSTOM_PROVIDER_ID, label: 'Outra API compatível', protocol: 'openai-chat', baseUrl: '', keyRequired: false },
];
export const DEFAULT_PROVIDER_ID = PROVIDER_PRESETS[0].id;
export function findProviderPreset(id: string): ProviderPreset {
    return PROVIDER_PRESETS.find((preset) => preset.id === id) ?? PROVIDER_PRESETS[0];
}
