'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { ExtensionHost } from '../host/extension-host';
export function useStartExtensions(): void {
    const session = useEditorSession();
    useEffect(() => session.extensions.start(), [session]);
}
export function useExtensionHost(): ExtensionHost {
    const { host } = useEditorSession().extensions;
    useSyncExternalStore(host.subscribe, host.getVersion, host.getVersion);
    return host;
}
