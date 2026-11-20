export const MULTIPLAYER_ROUTE = 'mp';
export const SERVICES_ROUTE = 'services';
const TRAILING_SLASHES = /\/+$/;
const ROUTE_MARKER = `/${MULTIPLAYER_ROUTE}/`;
export function multiplayerUrl(serverUrl: string, path: string): string {
    const url = new URL(serverUrl);
    const segments = path.split('/').map(encodeURIComponent).join('/');
    url.pathname = `${url.pathname.replace(TRAILING_SLASHES, '')}${ROUTE_MARKER}${segments}`;
    url.search = '';
    url.hash = '';
    return url.toString();
}
export function multiplayerPathOf(pathname: string): string | null {
    const start = pathname.indexOf(ROUTE_MARKER);
    if (start < 0)
        return null;
    try {
        return pathname.slice(start + ROUTE_MARKER.length).split('/').map(decodeURIComponent).join('/');
    }
    catch (error) {
        if (error instanceof URIError)
            return null;
        throw error;
    }
}
