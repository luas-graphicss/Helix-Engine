import type { JsonValue } from '../protocol';
import type { LinkConditions } from './local-link';
export type NetLink = {
    readonly kind: 'none';
} | {
    readonly kind: 'local';
    readonly conditions: LinkConditions;
} | {
    readonly kind: 'websocket';
    readonly url: string;
    readonly room: string;
    readonly ticket: JsonValue | null;
};
export const NO_LINK: NetLink = { kind: 'none' };
export function isAuthoritativeLink(link: NetLink): boolean {
    return link.kind !== 'none';
}
export function serverRunsHere(link: NetLink): boolean {
    return link.kind !== 'websocket';
}
