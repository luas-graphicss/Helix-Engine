import { BUILD_ENDPOINT, BUILD_ENVELOPE_CONTENT_TYPE, decodeBuildEnvelope, type NativeBuildLanguage, type NativeBuildMeta, type NativeBuildRequest, type NativeBuildStatus, type NativeToolchainStatus } from './build-protocol';
export interface BuildResponse {
    readonly meta: NativeBuildMeta;
    readonly artifact: Uint8Array | null;
}
export class BuildClient {
    constructor(private readonly endpoint: string = BUILD_ENDPOINT) { }
    async status(): Promise<NativeBuildStatus> {
        const response = await this.request({ method: 'GET' });
        return (await response.json()) as NativeBuildStatus;
    }
    async toolchain(language: NativeBuildLanguage): Promise<NativeToolchainStatus> {
        const status = await this.status();
        const found = status.toolchains.find((entry) => entry.language === language);
        if (!found)
            throw new Error(`o serviço de build não conhece a linguagem ${language}.`);
        if (!found.available)
            throw new Error(found.detail || `o compilador de ${language} não está instalado no servidor.`);
        return found;
    }
    async build(request: NativeBuildRequest): Promise<BuildResponse> {
        const response = await this.request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
        const type = response.headers.get('content-type') ?? '';
        if (!type.startsWith(BUILD_ENVELOPE_CONTENT_TYPE))
            throw new Error(`o serviço de build respondeu com ${type || 'um conteúdo sem tipo'} em vez de um artefato.`);
        return decodeBuildEnvelope(await response.arrayBuffer());
    }
    private async request(init: RequestInit): Promise<Response> {
        let response: Response;
        try {
            response = await fetch(this.endpoint, { ...init, cache: 'no-store' });
        }
        catch (cause) {
            throw new Error(`o serviço de build (${this.endpoint}) não respondeu: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
        if (!response.ok) {
            let detail = `${response.status} ${response.statusText}`.trim();
            try {
                const body = (await response.json()) as {
                    error?: unknown;
                };
                if (typeof body.error === 'string' && body.error)
                    detail = body.error;
            }
            catch {
            }
            throw new Error(`o serviço de build recusou o pedido: ${detail}`);
        }
        return response;
    }
}
