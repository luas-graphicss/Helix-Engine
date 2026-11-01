import { NextResponse, type NextRequest } from 'next/server';
import { handleLauncherRequest } from '@/launcher/launcher-proxy';
export const config = {
    matcher: ['/', '/__launcher/:path*'],
};
export async function proxy(request: NextRequest) {
    return (await handleLauncherRequest(request)) ?? NextResponse.next();
}
