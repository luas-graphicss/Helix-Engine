export const DEFAULT_ROOM = 'principal';
export const MAX_ROOM_NAME = 64;
export function normalizeRoomName(value: string): string {
    const name = value.trim().slice(0, MAX_ROOM_NAME);
    return name || DEFAULT_ROOM;
}
export function roomAddress(serverUrl: string, room: string): string {
    const url = new URL(serverUrl);
    url.searchParams.set('room', normalizeRoomName(room));
    return url.toString();
}
