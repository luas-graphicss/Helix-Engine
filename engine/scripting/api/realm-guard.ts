import type { RuntimeHost } from '../runtime/runtime-host';
import { HelixError } from '../runtime/script-errors';
import type { ScriptRunContext } from '../script-document';
export const CLIENT_ONLY_NAMESPACES: Record<string, string> = {
    input: 'entrada é do jogador: leia-a num script de cliente e mande a intenção com helix.net.call ou helix.net.emit.',
    gui: 'interface é do jogador: desenhe-a num script de cliente a partir do que helix.net.state replica.',
    camera: 'a câmera é de cada jogador: controle-a num script de cliente.',
    audio: 'o som toca na máquina do jogador: peça-o num script de cliente (helix.net.on recebe o evento do servidor).',
    render: 'render e pós-processamento são do cliente; o servidor não desenha.',
    post: 'pós-processamento é do cliente; o servidor não desenha.',
    vfx: 'efeitos visuais são do cliente: dispare-os com um evento do servidor (helix.net.broadcast) e crie-os num script de cliente.',
    player: 'posse e controle do personagem são do cliente; o servidor valida o movimento recebido.',
};
export const SERVER_ONLY_NAMESPACES: Record<string, string> = {
    storage: 'saves na máquina do jogador podem ser editados por ele; guarde progresso, moedas e inventário num script de servidor e entregue ao cliente por helix.net.state.',
};
const REALM_LABEL: Record<ScriptRunContext, string> = { shared: 'compartilhado', client: 'de cliente', server: 'de servidor' };
export function guardNamespace<T extends object>(host: RuntimeHost, name: string, api: T, forbidden: ScriptRunContext, why: string): T {
    return new Proxy(api, {
        get(target, property, receiver) {
            const context = host.current?.runContext;
            if (context === forbidden && host.net.isAuthoritative && typeof property === 'string' && property !== 'then' && property !== 'toJSON') {
                throw new HelixError(`helix.${name} não existe num script ${REALM_LABEL[forbidden]}: ${why}`);
            }
            return Reflect.get(target, property, receiver);
        },
    });
}
export function guardRealms(host: RuntimeHost, root: Record<string, unknown>): Record<string, unknown> {
    for (const [name, why] of Object.entries(CLIENT_ONLY_NAMESPACES)) {
        const api = root[name];
        if (api && typeof api === 'object')
            root[name] = guardNamespace(host, name, api, 'server', why);
    }
    for (const [name, why] of Object.entries(SERVER_ONLY_NAMESPACES)) {
        const api = root[name];
        if (api && typeof api === 'object')
            root[name] = guardNamespace(host, name, api, 'client', why);
    }
    return root;
}
